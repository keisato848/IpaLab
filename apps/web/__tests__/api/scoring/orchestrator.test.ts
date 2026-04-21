import { describe, it, expect } from 'vitest';
import { Scoring } from '@ipa-lab/shared';
import { orchestrateShortAnswer } from '@/lib/scoring/orchestrator';
import { collectEvents } from '@/lib/scoring/sse';
import type { ShortAnswerQuestionMeta } from '@/lib/scoring/questionMeta';
import type { CallPerspectiveLlm } from '@/lib/scoring/llmClient';

const meta: ShortAnswerQuestionMeta = {
  questionId: 'AP-2023S-PM-01-q1',
  questionText: '不正アクセス対策を述べよ',
  modelAnswer: '多要素認証を導入する',
  charLimit: 50,
  scoringPoints: [],
  requiredKeywords: Scoring.getRequiredKeywords('AP-2023S-PM-01-q1'),
  questionMaxScore: 8,
};

const makeLlmStub = (perPerspectiveScore: Record<string, number>): CallPerspectiveLlm => {
  return async (prompt: string) => {
    const id = (Object.keys(perPerspectiveScore) as string[]).find((k) =>
      prompt.includes(Scoring.SHORT_ANSWER_PERSPECTIVE_MAP[k as never].name as never),
    );
    return {
      score: id ? perPerspectiveScore[id] : 80,
      rationale: `mock for ${id ?? 'unknown'}`,
      matched_keywords: [],
      missing_keywords: [],
    };
  };
};

describe('orchestrateShortAnswer', () => {
  it('観点数ぶんの perspective イベント + 1つの complete を yield する', async () => {
    const evts = await collectEvents(
      orchestrateShortAnswer({
        meta,
        userAnswer: '多要素認証を全社で導入する',
        callLlm: makeLlmStub({
          keyword_coverage: 90,
          logical_structure: 80,
          expression_accuracy: 85,
          conciseness: 70,
        }),
      }),
    );
    const persp = evts.filter((e) => e.event === 'perspective');
    const complete = evts.filter((e) => e.event === 'complete');
    expect(persp.length).toBe(4);
    expect(complete.length).toBe(1);
    expect(persp.map((e) => (e.data as { id: string }).id).sort()).toEqual(
      ['conciseness', 'expression_accuracy', 'keyword_coverage', 'logical_structure'],
    );
  });

  it('keyword_coverage は LLM とルール下限値の min を採用する', async () => {
    // ユーザー解答に T1=多要素認証, T3=最小権限の原則 が含まれ、T2=権限昇格 が欠落
    // → ルール下限: 100 - 12*1 = 88
    // LLM=99 → 採用は min(99, 88) = 88
    const evts = await collectEvents(
      orchestrateShortAnswer({
        meta,
        userAnswer: '多要素認証と最小権限の原則を導入する',
        callLlm: makeLlmStub({ keyword_coverage: 99, logical_structure: 80, expression_accuracy: 80, conciseness: 80 }),
      }),
    );
    const kw = evts.find(
      (e) => e.event === 'perspective' && (e.data as { id: string }).id === 'keyword_coverage',
    )!.data as { score: number; ruleBasedScore: number; llmScore: number };
    expect(kw.llmScore).toBe(99);
    expect(kw.ruleBasedScore).toBe(88);
    expect(kw.score).toBe(88);
  });

  it('LLM がスコアを甘くしても T1 欠落は確実に減点される', async () => {
    // ユーザー解答に T1=多要素認証 が無い
    // T1=1件 missing → ルール下限: 100 - 25 = 75
    const evts = await collectEvents(
      orchestrateShortAnswer({
        meta,
        userAnswer: 'パスワードを長くする',
        callLlm: makeLlmStub({ keyword_coverage: 100, logical_structure: 100, expression_accuracy: 100, conciseness: 100 }),
      }),
    );
    const kw = evts.find(
      (e) => e.event === 'perspective' && (e.data as { id: string }).id === 'keyword_coverage',
    )!.data as { score: number; tierBreakdown: { T1: { missing: string[] } } };
    expect(kw.tierBreakdown.T1.missing).toContain('多要素認証');
    expect(kw.score).toBeLessThanOrEqual(75);
  });

  it('観点失敗時も complete を返す（部分結果フォールバック）', async () => {
    const failingLlm: CallPerspectiveLlm = async (prompt) => {
      if (prompt.includes('表現の正確性')) throw new Error('boom');
      return { score: 80, rationale: 'ok', matched_keywords: [], missing_keywords: [] };
    };
    const evts = await collectEvents(
      orchestrateShortAnswer({ meta, userAnswer: '多要素認証を導入', callLlm: failingLlm }),
    );
    const errs = evts.filter((e) => e.event === 'perspective_error');
    const complete = evts.find((e) => e.event === 'complete');
    expect(errs.length).toBe(1);
    expect((errs[0].data as { id: string }).id).toBe('expression_accuracy');
    expect(complete).toBeDefined();
  });

  it('complete event は totalScore / maxScore / scoringVersion を持つ', async () => {
    const evts = await collectEvents(
      orchestrateShortAnswer({
        meta,
        userAnswer: '多要素認証',
        callLlm: makeLlmStub({ keyword_coverage: 80, logical_structure: 80, expression_accuracy: 80, conciseness: 80 }),
      }),
    );
    const complete = evts.find((e) => e.event === 'complete')!.data as Record<string, unknown>;
    expect(complete.questionId).toBe('AP-2023S-PM-01-q1');
    expect(complete.format).toBe('short_answer');
    expect(complete.maxScore).toBe(8);
    expect(complete.scoringVersion).toBe(Scoring.SCORING_VERSION);
    expect(typeof complete.totalScore).toBe('number');
  });
});
