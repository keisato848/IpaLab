/**
 * 系統B（論述式）採点API v2 オーケストレータ
 *
 * 責務:
 * 1. 3 小問 × 6 観点 = 18 個の LLM 呼び出しを並列起動
 * 2. 完了順に SSE `perspective` イベントを yield（各イベントに subQuestion 付与）
 * 3. character_count_compliance 観点はルールベースの下限値（実文字数 vs charMin/charMax）と
 *    LLM スコアの **min** を採用（甘採点防止 / 設計書 §3.2 / 系統A 同方針）
 * 4. 小問単位で観点が揃った時点で `sub_question_complete` を yield
 * 5. 全観点完了後に `aggregateEssayOverall` でランク・総合スコアを算出して `complete` を yield
 *
 * LLM 呼び出しは DI 可能 (`callLlm`)。テストではスタブを差し替える。
 */

import { Scoring } from '@ipa-lab/shared';
type EssayPerspectiveScore = Scoring.EssayPerspectiveScore;
type EssaySubQuestionScore = Scoring.EssaySubQuestionScore;
type EssaySubQuestion = Scoring.EssaySubQuestion;
import type { CallPerspectiveLlm } from './llmClient';
import type { EssayQuestionMeta } from './questionMeta';
import type { SseEvent } from './sse';

export interface OrchestrateEssayInput {
  meta: EssayQuestionMeta;
  answer: { setsumonA: string; setsumonI: string; setsumonU: string };
  callLlm: CallPerspectiveLlm;
}

const SUB_QUESTION_LABEL_TO_SUB: Record<'A' | 'I' | 'U', EssaySubQuestion> = {
  A: 'ア',
  I: 'イ',
  U: 'ウ',
};

interface SubQuestionContext {
  key: 'A' | 'I' | 'U';
  subQuestion: EssaySubQuestion;
  text: string;
  charCount: number;
  meta: EssayQuestionMeta['subQuestions']['A'];
  ruleCharScore: number;
  ruleCharFlags: string[];
}

/** 文字数ルールに基づく character_count_compliance スコア（0-100） */
export function computeCharCountRuleScore(
  charCount: number,
  charMin: number,
  charMax: number,
): { score: number; flags: string[] } {
  const flags: string[] = [];
  if (charCount === 0) {
    return { score: 0, flags: ['EMPTY'] };
  }
  // 半分未満 → 0（aggregator のハードペナルティで C 以下相当に）
  if (charMin > 0 && charCount < charMin / 2) {
    flags.push('FATAL_UNDER');
    return { score: 0, flags };
  }
  if (charMin > 0 && charCount < charMin) {
    const ratio = charCount / charMin;
    flags.push('UNDER');
    return { score: Math.round(ratio * 60), flags };
  }
  if (charCount > charMax) {
    const over = charCount - charMax;
    const overRatio = over / charMax;
    flags.push('OVER');
    // 超過率 0% → 80, 20% 超 → 0
    return { score: Math.max(0, Math.round(80 - overRatio * 400)), flags };
  }
  return { score: 100, flags: [] };
}

export async function* orchestrateEssay(
  input: OrchestrateEssayInput,
): AsyncGenerator<SseEvent> {
  const { meta, answer, callLlm } = input;

  const contexts: SubQuestionContext[] = (['A', 'I', 'U'] as const).map((key) => {
    const text = (key === 'A' ? answer.setsumonA : key === 'I' ? answer.setsumonI : answer.setsumonU) ?? '';
    const subMeta = meta.subQuestions[key];
    const charCount = Array.from(text).length;
    const rule = computeCharCountRuleScore(charCount, subMeta.charMin, subMeta.charMax);
    return {
      key,
      subQuestion: SUB_QUESTION_LABEL_TO_SUB[key],
      text,
      charCount,
      meta: subMeta,
      ruleCharScore: rule.score,
      ruleCharFlags: rule.flags,
    };
  });

  // 先に各小問の枠を UI 側に通知
  for (const ctx of contexts) {
    yield {
      event: 'sub_question_start',
      data: {
        subQuestion: ctx.subQuestion,
        charCount: ctx.charCount,
        charMin: ctx.meta.charMin,
        charMax: ctx.meta.charMax,
      },
    };
  }

  // 18 個のタスクを生成
  type TaskKey = string;
  interface TaskResult {
    ctx: SubQuestionContext;
    perspective: Scoring.EssayPerspectiveDef;
    ok: boolean;
    raw?: Awaited<ReturnType<CallPerspectiveLlm>>;
    err?: unknown;
  }
  const tasks = new Map<TaskKey, Promise<TaskResult>>();
  for (const ctx of contexts) {
    for (const perspective of Scoring.ESSAY_RUBRIC) {
      const key = `${ctx.subQuestion}:${perspective.id}`;
      const prompt = Scoring.buildEssayPrompt({
        perspective,
        examType: meta.examType,
        theme: meta.theme,
        subQuestion: ctx.subQuestion,
        subQuestionRequirements: ctx.meta.requirements,
        charMin: ctx.meta.charMin,
        charMax: ctx.meta.charMax,
        scoringPoints: ctx.meta.scoringPoints,
        userAnswerForSubQuestion: ctx.text,
      });
      tasks.set(
        key,
        callLlm(prompt).then(
          (raw) => ({ ctx, perspective, ok: true, raw }),
          (err) => ({ ctx, perspective, ok: false, err }),
        ),
      );
    }
  }

  // 観点完了を集約（小問単位）
  const collectedBySub: Record<EssaySubQuestion, EssayPerspectiveScore[]> = {
    ア: [],
    イ: [],
    ウ: [],
  };

  while (tasks.size > 0) {
    const winner = await Promise.race(
      Array.from(tasks.entries()).map(async ([key, p]) => ({ key, result: await p })),
    );
    tasks.delete(winner.key);
    const { result } = winner;
    const { ctx, perspective } = result;

    if (!result.ok) {
      yield {
        event: 'perspective_error',
        data: {
          subQuestion: ctx.subQuestion,
          id: perspective.id,
          message: result.err instanceof Error ? result.err.message : String(result.err),
        },
      };
      collectedBySub[ctx.subQuestion].push({
        id: perspective.id,
        name: perspective.name,
        weight: perspective.weight,
        score: 0,
        rationale: '採点に失敗しました（フォールバック）',
      });
    } else {
      const raw = result.raw!;
      let finalScore = raw.score;
      const extra: Record<string, unknown> = {};
      if (perspective.id === 'character_count_compliance') {
        finalScore = Math.min(raw.score, ctx.ruleCharScore);
        extra.ruleScore = ctx.ruleCharScore;
        extra.llmScore = raw.score;
        extra.charCount = ctx.charCount;
        extra.charFlags = ctx.ruleCharFlags;
      }
      const persp: EssayPerspectiveScore = {
        id: perspective.id,
        name: perspective.name,
        weight: perspective.weight,
        score: finalScore,
        rationale: raw.rationale,
        evidenceQuotes: raw.evidence_quotes ?? [],
      };
      collectedBySub[ctx.subQuestion].push(persp);
      yield {
        event: 'perspective',
        data: { subQuestion: ctx.subQuestion, ...persp, ...extra },
      };
    }

    // 小問の 6 観点が揃ったら sub_question_complete を yield
    if (collectedBySub[ctx.subQuestion].length === Scoring.ESSAY_RUBRIC.length) {
      // rubric 定義順に並べ替え
      const order = new Map(Scoring.ESSAY_RUBRIC.map((p, i) => [p.id, i]));
      collectedBySub[ctx.subQuestion].sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      );
      const subScore = Scoring.aggregateEssaySubQuestionScore(
        collectedBySub[ctx.subQuestion],
      );
      yield {
        event: 'sub_question_complete',
        data: {
          subQuestion: ctx.subQuestion,
          score: subScore,
          charCount: ctx.charCount,
          perspectiveScores: collectedBySub[ctx.subQuestion],
        },
      };
    }
  }

  // 全体集計
  const subWeightMap: Record<EssaySubQuestion, number> = { ア: 0, イ: 0, ウ: 0 };
  for (const w of Scoring.ESSAY_SUB_QUESTION_WEIGHTS) subWeightMap[w.subQuestion] = w.weight;
  const subQuestionScores: EssaySubQuestionScore[] = (
    ['ア', 'イ', 'ウ'] as EssaySubQuestion[]
  ).map((sq) => ({
    subQuestion: sq,
    score: Scoring.aggregateEssaySubQuestionScore(collectedBySub[sq]),
    weight: subWeightMap[sq],
    perspectiveScores: collectedBySub[sq],
  }));

  const overall = Scoring.aggregateEssayOverall(subQuestionScores);

  yield {
    event: 'complete',
    data: {
      questionId: meta.questionId,
      format: 'essay',
      scoringVersion: Scoring.SCORING_VERSION,
      scoredAt: new Date().toISOString(),
      examType: meta.examType,
      overallRank: overall.overallRank,
      overallScore: overall.overallScore,
      characterCounts: {
        setsumonA: contexts[0].charCount,
        setsumonI: contexts[1].charCount,
        setsumonU: contexts[2].charCount,
      },
      subQuestionScores,
    },
  };
}
