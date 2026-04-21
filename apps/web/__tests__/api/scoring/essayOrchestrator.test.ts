import { describe, it, expect, vi } from 'vitest';
import { Scoring } from '@ipa-lab/shared';
import {
  orchestrateEssay,
  computeCharCountRuleScore,
} from '@/lib/scoring/essayOrchestrator';
import { collectEvents } from '@/lib/scoring/sse';
import type { EssayQuestionMeta } from '@/lib/scoring/questionMeta';
import type { CallPerspectiveLlm } from '@/lib/scoring/llmClient';

const META: EssayQuestionMeta = {
  questionId: 'PM-2024A-PM2-q1',
  examType: 'PM',
  theme: 'プロジェクト計画における利害関係者との調整',
  subQuestions: {
    A: { requirements: 'r-A', charMin: 0, charMax: 800, scoringPoints: ['p1'] },
    I: { requirements: 'r-I', charMin: 800, charMax: 1600, scoringPoints: ['p1'] },
    U: { requirements: 'r-U', charMin: 600, charMax: 1200, scoringPoints: ['p1'] },
  },
};

const validAnswer = {
  setsumonA: 'あ'.repeat(700),
  setsumonI: 'い'.repeat(1200),
  setsumonU: 'う'.repeat(900),
};

function makeStub(scoreFn?: (perspectiveId: string, sub: string) => number): CallPerspectiveLlm {
  return vi.fn(async (prompt: string) => {
    const sub = ['ア', 'イ', 'ウ'].find((s) => prompt.includes(`設問${s}`)) ?? 'ア';
    const id =
      Scoring.ESSAY_RUBRIC.find((p) => prompt.includes(`観点「${p.name}」`))?.id ??
      'question_alignment';
    return {
      score: scoreFn ? scoreFn(id, sub) : 80,
      rationale: `mock-${id}-${sub}`,
      evidence_quotes: ['ev1'],
    };
  });
}

describe('orchestrateEssay', () => {
  it('18観点 + 3 sub_question_start + 3 sub_question_complete + complete をすべて出力する', async () => {
    const events = await collectEvents(
      orchestrateEssay({ meta: META, answer: validAnswer, callLlm: makeStub() }),
    );
    expect(events.filter((e) => e.event === 'sub_question_start')).toHaveLength(3);
    expect(events.filter((e) => e.event === 'perspective')).toHaveLength(18);
    expect(events.filter((e) => e.event === 'sub_question_complete')).toHaveLength(3);
    expect(events.filter((e) => e.event === 'complete')).toHaveLength(1);
  });

  it('complete イベントは overallRank/overallScore/characterCounts を含む', async () => {
    const events = await collectEvents(
      orchestrateEssay({ meta: META, answer: validAnswer, callLlm: makeStub(() => 85) }),
    );
    const complete = events.find((e) => e.event === 'complete')!;
    const data = complete.data as Record<string, unknown>;
    expect(data.format).toBe('essay');
    expect(['A', 'B', 'C', 'D']).toContain(data.overallRank);
    expect(typeof data.overallScore).toBe('number');
    const counts = data.characterCounts as Record<string, number>;
    expect(counts.setsumonA).toBe(700);
    expect(counts.setsumonI).toBe(1200);
    expect(counts.setsumonU).toBe(900);
  });

  it('character_count_compliance は LLM スコアとルールスコアの min を採用する', async () => {
    // 設問ア: 100字（上限800、下限0なので100点）→ ルール100, LLM 30 → min=30
    // 設問イ: 400字（下限800の半分以上だが下限未満）→ ルール 400/800*60=30, LLM 90 → min=30
    const answer = {
      setsumonA: 'あ'.repeat(100),
      setsumonI: 'い'.repeat(400),
      setsumonU: 'う'.repeat(900),
    };
    const events = await collectEvents(
      orchestrateEssay({
        meta: META,
        answer,
        callLlm: makeStub((id) => (id === 'character_count_compliance' ? 90 : 80)),
      }),
    );
    const charPerspsI = events.find(
      (e) =>
        e.event === 'perspective' &&
        (e.data as Record<string, unknown>).subQuestion === 'イ' &&
        (e.data as Record<string, unknown>).id === 'character_count_compliance',
    );
    expect(charPerspsI).toBeDefined();
    const data = charPerspsI!.data as Record<string, unknown>;
    expect(data.score).toBe(30);
    expect(data.ruleScore).toBe(30);
    expect(data.llmScore).toBe(90);
    expect(data.charCount).toBe(400);
    expect((data.charFlags as string[])).toContain('UNDER');
  });

  it('LLM 失敗観点は perspective_error を出すがフォールバックで集計を継続する', async () => {
    const failing: CallPerspectiveLlm = vi.fn(async (prompt: string) => {
      if (prompt.includes('観点「論理構成」') && prompt.includes('設問イ')) {
        throw new Error('boom');
      }
      return { score: 75, rationale: 'ok', evidence_quotes: [] };
    });
    const events = await collectEvents(
      orchestrateEssay({ meta: META, answer: validAnswer, callLlm: failing }),
    );
    const errors = events.filter((e) => e.event === 'perspective_error');
    expect(errors).toHaveLength(1);
    expect((errors[0].data as Record<string, unknown>).subQuestion).toBe('イ');
    // それでも complete が出る
    expect(events.filter((e) => e.event === 'complete')).toHaveLength(1);
  });
});

describe('computeCharCountRuleScore', () => {
  it('字数 0 は 0 点 + EMPTY フラグ', () => {
    expect(computeCharCountRuleScore(0, 800, 1600)).toEqual({ score: 0, flags: ['EMPTY'] });
  });
  it('下限の半分未満は 0 点 + FATAL_UNDER', () => {
    const r = computeCharCountRuleScore(300, 800, 1600);
    expect(r.score).toBe(0);
    expect(r.flags).toContain('FATAL_UNDER');
  });
  it('下限未満は線形に減点 + UNDER フラグ', () => {
    const r = computeCharCountRuleScore(600, 800, 1600);
    expect(r.flags).toContain('UNDER');
    expect(r.score).toBeLessThan(60);
    expect(r.score).toBeGreaterThan(0);
  });
  it('範囲内は 100 点', () => {
    expect(computeCharCountRuleScore(1000, 800, 1600)).toEqual({ score: 100, flags: [] });
  });
  it('上限超過は減点 + OVER フラグ', () => {
    const r = computeCharCountRuleScore(1700, 800, 1600);
    expect(r.flags).toContain('OVER');
    expect(r.score).toBeLessThan(80);
  });
});
