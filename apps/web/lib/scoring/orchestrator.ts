/**
 * 採点API v2 オーケストレータ（系統A: 記述式）
 *
 * 責務:
 * 1. 4観点を並列に LLM 起動
 * 2. 完了順に SSE `perspective` イベントを yield
 * 3. keyword_coverage 観点に対しては、LLM スコアと
 *    `Scoring.scoreKeywordCoverage` のルールベース下限値の **min** を採用
 *    （設計書 #14 §3.2 / SOP #22 §5.1）
 * 4. 全観点完了後に `Scoring.aggregateShortAnswerScore` で総合点を算出して `complete` イベントを yield
 *
 * LLM 呼び出しは DI 可能 (`callLlm` 引数) でテスト時にスタブを差し替える。
 */

import { Scoring } from '@ipa-lab/shared';
type ShortAnswerPerspectiveScore = Scoring.ShortAnswerPerspectiveScore;
import type { CallPerspectiveLlm } from './llmClient';
import type { ShortAnswerQuestionMeta } from './questionMeta';
import type { SseEvent } from './sse';

export interface OrchestrateShortAnswerInput {
  meta: ShortAnswerQuestionMeta;
  userAnswer: string;
  callLlm: CallPerspectiveLlm;
}

export async function* orchestrateShortAnswer(
  input: OrchestrateShortAnswerInput,
): AsyncGenerator<SseEvent> {
  const { meta, userAnswer, callLlm } = input;

  // 事前計算: ティア別 keyword 一致解析（LLM の如何にかかわらず確定する事実）
  const matchResult = Scoring.detectMatchedKeywords(userAnswer, meta.requiredKeywords);
  const ruleBasedKeywordCoverage = Scoring.scoreKeywordCoverage(matchResult);

  // 観点ごとに Promise を作成し、完了順に yield するため each に id を付ける
  const tasks = Scoring.SHORT_ANSWER_RUBRIC.map((perspective) => {
    const prompt = Scoring.buildShortAnswerPrompt({
      perspective,
      questionText: meta.questionText,
      modelAnswer: meta.modelAnswer,
      requiredKeywords: meta.requiredKeywords,
      charLimit: meta.charLimit,
      userAnswer,
    });
    return {
      id: perspective.id,
      promise: callLlm(prompt).then(
        (raw) => ({ ok: true as const, perspective, raw }),
        (err: unknown) => ({ ok: false as const, perspective, err }),
      ),
    };
  });

  const collected: ShortAnswerPerspectiveScore[] = [];
  // 完了順に yield（Promise.race を逐次行う）
  const pending = new Map(tasks.map((t) => [t.id, t.promise]));
  while (pending.size > 0) {
    const winner = await Promise.race(
      Array.from(pending.entries()).map(async ([id, p]) => ({ id, result: await p })),
    );
    pending.delete(winner.id);
    const { result } = winner;

    if (!result.ok) {
      yield {
        event: 'perspective_error',
        data: {
          id: result.perspective.id,
          message: result.err instanceof Error ? result.err.message : String(result.err),
        },
      };
      // 失敗観点は score=0 として続行（部分結果でも UI に出す方針）
      collected.push({
        id: result.perspective.id,
        name: result.perspective.name,
        weight: result.perspective.weight,
        score: 0,
        rationale: '採点に失敗しました（フォールバック）',
        matchedKeywords: [],
        missingKeywords: [],
      });
      continue;
    }

    const { perspective, raw } = result;
    let finalScore = raw.score;
    const extra: Record<string, unknown> = {};

    if (perspective.id === 'keyword_coverage') {
      // ルールベース下限値との min を採用 (設計書 #14 §3.2)
      finalScore = Math.min(raw.score, ruleBasedKeywordCoverage.score);
      extra.tierBreakdown = matchResult.byTier;
      extra.rulePenalties = ruleBasedKeywordCoverage.penalties;
      extra.ruleBasedScore = ruleBasedKeywordCoverage.score;
      extra.llmScore = raw.score;
    }

    const persp: ShortAnswerPerspectiveScore = {
      id: perspective.id,
      name: perspective.name,
      weight: perspective.weight,
      score: finalScore,
      rationale: raw.rationale,
      matchedKeywords:
        perspective.id === 'keyword_coverage' ? matchResult.matched : raw.matched_keywords ?? [],
      missingKeywords:
        perspective.id === 'keyword_coverage' ? matchResult.missing : raw.missing_keywords ?? [],
    };
    collected.push(persp);

    yield {
      event: 'perspective',
      data: { ...persp, ...extra },
    };
  }

  // 並べ替え: rubric 定義順
  const order = new Map(Scoring.SHORT_ANSWER_RUBRIC.map((p, i) => [p.id, i]));
  collected.sort((a, b) => (order.get(a.id)! - order.get(b.id)!));

  const totalNormalized = Scoring.aggregateShortAnswerScore(collected);
  const totalScaled = Scoring.scaleToQuestionScore(
    totalNormalized.weightedScore,
    meta.questionMaxScore,
  );

  yield {
    event: 'complete',
    data: {
      questionId: meta.questionId,
      format: 'short_answer',
      scoringVersion: Scoring.SCORING_VERSION,
      scoredAt: new Date().toISOString(),
      perspectiveScores: collected,
      totalScore: totalScaled,
      maxScore: meta.questionMaxScore,
      keywordTierBreakdown: matchResult.byTier,
    },
  };
}
