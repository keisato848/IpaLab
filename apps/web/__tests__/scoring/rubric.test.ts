import { describe, it, expect } from 'vitest';
import { Scoring } from '@ipa-lab/shared';

const {
  SHORT_ANSWER_RUBRIC,
  ESSAY_RUBRIC,
  ESSAY_SUB_QUESTION_WEIGHTS,
  scoreToRank,
  aggregateShortAnswerScore,
  aggregateEssaySubQuestionScore,
  aggregateEssayOverall,
  scaleToQuestionScore,
  detectMatchedKeywords,
  getRequiredKeywords,
  buildShortAnswerPrompt,
  buildEssayPrompt,
  SHORT_ANSWER_KEYWORD_DICTIONARY,
  SHORT_ANSWER_PERSPECTIVE_MAP,
  ESSAY_PERSPECTIVE_MAP,
  SCORING_VERSION,
} = Scoring;

describe('Issue #175: 採点ルーブリック', () => {
  describe('系統A 記述式ルーブリック', () => {
    it('観点は4つで構成される', () => {
      expect(SHORT_ANSWER_RUBRIC).toHaveLength(4);
    });

    it('観点IDが設計書通り', () => {
      expect(SHORT_ANSWER_RUBRIC.map((p) => p.id)).toEqual([
        'keyword_coverage',
        'logical_structure',
        'expression_accuracy',
        'conciseness',
      ]);
    });

    it('配点比率の合計は 1.0 (40+25+20+15)', () => {
      const sum = SHORT_ANSWER_RUBRIC.reduce((s, p) => s + p.weight, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('PERSPECTIVE_MAP で id 経由参照できる', () => {
      expect(SHORT_ANSWER_PERSPECTIVE_MAP.keyword_coverage.weight).toBe(0.4);
    });
  });

  describe('系統B 論述式ルーブリック', () => {
    it('観点は6つで構成される', () => {
      expect(ESSAY_RUBRIC).toHaveLength(6);
    });

    it('観点IDが設計書通り', () => {
      expect(ESSAY_RUBRIC.map((p) => p.id)).toEqual([
        'question_alignment',
        'logical_composition',
        'concreteness_experience',
        'feasibility_validity',
        'character_count_compliance',
        'expression_quality',
      ]);
    });

    it('配点比率の合計は 1.0', () => {
      const sum = ESSAY_RUBRIC.reduce((s, p) => s + p.weight, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('設問ア/イ/ウの重み合計は 1.0', () => {
      const sum = ESSAY_SUB_QUESTION_WEIGHTS.reduce((s, w) => s + w.weight, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('字数要件: 設問ア 0-800, 設問イ 800-1600, 設問ウ 600-1200', () => {
      const a = ESSAY_SUB_QUESTION_WEIGHTS.find((w) => w.subQuestion === 'ア')!;
      const i = ESSAY_SUB_QUESTION_WEIGHTS.find((w) => w.subQuestion === 'イ')!;
      const u = ESSAY_SUB_QUESTION_WEIGHTS.find((w) => w.subQuestion === 'ウ')!;
      expect([a.charMin, a.charMax]).toEqual([0, 800]);
      expect([i.charMin, i.charMax]).toEqual([800, 1600]);
      expect([u.charMin, u.charMax]).toEqual([600, 1200]);
    });

    it('PERSPECTIVE_MAP で id 経由参照できる', () => {
      expect(ESSAY_PERSPECTIVE_MAP.question_alignment.weight).toBe(0.25);
    });
  });

  describe('scoreToRank: IPAランク判定', () => {
    it.each([
      [100, 'A'],
      [80, 'A'],
      [79, 'B'],
      [60, 'B'],
      [59, 'C'],
      [40, 'C'],
      [39, 'D'],
      [0, 'D'],
    ])('score=%i → %s', (score, rank) => {
      expect(scoreToRank(score)).toBe(rank);
    });
  });

  describe('SCORING_VERSION', () => {
    it('バージョン文字列が存在', () => {
      expect(SCORING_VERSION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
    });
  });
});

describe('Issue #175: 採点アグリゲータ', () => {
  describe('aggregateShortAnswerScore', () => {
    it('空配列なら 0 / coverage 0', () => {
      const r = aggregateShortAnswerScore([]);
      expect(r).toEqual({ weightedScore: 0, coverage: 0 });
    });

    it('全観点満点なら 100 / coverage 1', () => {
      const all = SHORT_ANSWER_RUBRIC.map((p) => ({
        id: p.id,
        name: p.name,
        score: 100,
        weight: p.weight,
        rationale: '',
      }));
      const r = aggregateShortAnswerScore(all);
      expect(r.weightedScore).toBe(100);
      expect(r.coverage).toBe(1);
    });

    it('観点が部分到着していても加重平均できる (SSE 進捗用)', () => {
      const partial = [
        { id: 'keyword_coverage' as const, name: 'kw', score: 80, weight: 0.4, rationale: '' },
        { id: 'logical_structure' as const, name: 'ls', score: 60, weight: 0.25, rationale: '' },
      ];
      const r = aggregateShortAnswerScore(partial);
      expect(r.weightedScore).toBeCloseTo(72.3, 1);
      expect(r.coverage).toBeCloseTo(0.5, 5);
    });

    it('weight=0 のみなら 0', () => {
      const r = aggregateShortAnswerScore([
        { id: 'keyword_coverage', name: 'kw', score: 50, weight: 0, rationale: '' },
      ]);
      expect(r.weightedScore).toBe(0);
    });
  });

  describe('scaleToQuestionScore', () => {
    it('100点 → maxScore そのまま', () => {
      expect(scaleToQuestionScore(100, 8)).toBe(8);
    });
    it('50点 → maxScore の半分', () => {
      expect(scaleToQuestionScore(50, 6)).toBe(3);
    });
  });

  describe('aggregateEssaySubQuestionScore', () => {
    it('全観点満点なら 100', () => {
      const all = ESSAY_RUBRIC.map((p) => ({
        id: p.id,
        name: p.name,
        score: 100,
        weight: p.weight,
        rationale: '',
      }));
      expect(aggregateEssaySubQuestionScore(all)).toBe(100);
    });
    it('空配列なら 0', () => {
      expect(aggregateEssaySubQuestionScore([])).toBe(0);
    });
  });

  describe('aggregateEssayOverall', () => {
    const buildSub = (sq: 'ア' | 'イ' | 'ウ', score: number, overrides: Record<string, number> = {}) => ({
      subQuestion: sq,
      score,
      weight: ESSAY_SUB_QUESTION_WEIGHTS.find((w) => w.subQuestion === sq)!.weight,
      perspectiveScores: ESSAY_RUBRIC.map((p) => ({
        id: p.id,
        name: p.name,
        score: overrides[p.id] ?? score,
        weight: p.weight,
        rationale: '',
      })),
    });

    it('全小問80点なら overallScore=80, ランクA', () => {
      const r = aggregateEssayOverall([buildSub('ア', 80), buildSub('イ', 80), buildSub('ウ', 80)]);
      expect(r.overallScore).toBe(80);
      expect(r.overallRank).toBe('A');
    });

    it('重み付け: ア60 / イ80 / ウ70 → 0.25*60+0.45*80+0.30*70 = 72', () => {
      const r = aggregateEssayOverall([buildSub('ア', 60), buildSub('イ', 80), buildSub('ウ', 70)]);
      expect(r.overallScore).toBeCloseTo(72, 1);
      expect(r.overallRank).toBe('B');
    });

    it('ハードペナルティ: 設問落とし(question_alignment=0)はランクD固定', () => {
      const r = aggregateEssayOverall([
        buildSub('ア', 80, { question_alignment: 0 }),
        buildSub('イ', 80),
        buildSub('ウ', 80),
      ]);
      expect(r.overallRank).toBe('D');
      expect(r.overallScore).toBeLessThanOrEqual(39);
    });

    it('ハードペナルティ: 字数違反(character_count_compliance=0)はC上限', () => {
      const r = aggregateEssayOverall([
        buildSub('ア', 90, { character_count_compliance: 0 }),
        buildSub('イ', 90),
        buildSub('ウ', 90),
      ]);
      expect(r.overallRank).toBe('C');
      expect(r.overallScore).toBeLessThanOrEqual(59);
    });

    it('空配列なら overallScore=0, ランクD', () => {
      const r = aggregateEssayOverall([]);
      expect(r).toEqual({ overallScore: 0, overallRank: 'D' });
    });
  });
});

describe('Issue #175: キーワード辞書', () => {
  it('辞書はオブジェクト形式 (questionId → KeywordEntry[])', () => {
    expect(typeof SHORT_ANSWER_KEYWORD_DICTIONARY).toBe('object');
    const sample = Object.values(SHORT_ANSWER_KEYWORD_DICTIONARY)[0];
    expect(Array.isArray(sample)).toBe(true);
    expect(sample[0]).toHaveProperty('primary');
  });

  it('getRequiredKeywords: 未登録IDなら空配列', () => {
    expect(getRequiredKeywords('UNKNOWN-ID')).toEqual([]);
  });

  it('getRequiredKeywords: 登録済みIDで取得できる', () => {
    const kws = getRequiredKeywords('AP-2023S-PM-01-q1');
    expect(kws.length).toBeGreaterThan(0);
    expect(kws[0]).toHaveProperty('primary');
  });

  it('detectMatchedKeywords: primary 一致を検出', () => {
    const required = [{ primary: '多要素認証' }, { primary: '権限昇格' }];
    const r = detectMatchedKeywords('多要素認証を導入することで対策する', required);
    expect(r.matched).toContain('多要素認証');
    expect(r.missing).toContain('権限昇格');
  });

  it('detectMatchedKeywords: synonym 一致でも primary が記録される', () => {
    const required = [{ primary: '多要素認証', synonyms: ['MFA', '多段階認証'] }];
    const r = detectMatchedKeywords('MFA を全社で展開した', required);
    expect(r.matched).toEqual(['多要素認証']);
    expect(r.missing).toEqual([]);
  });

  it('detectMatchedKeywords: 空文字列は全 missing', () => {
    const required = [{ primary: 'A' }, { primary: 'B' }];
    const r = detectMatchedKeywords('', required);
    expect(r.matched).toEqual([]);
    expect(r.missing).toEqual(['A', 'B']);
  });
});

describe('Issue #175: 採点プロンプト雛形', () => {
  it('buildShortAnswerPrompt: 必須要素を含む', () => {
    const p = buildShortAnswerPrompt({
      perspective: SHORT_ANSWER_PERSPECTIVE_MAP.keyword_coverage,
      questionText: 'Qテキスト',
      modelAnswer: 'モデル解答',
      requiredKeywords: ['キーワード1', 'キーワード2'],
      charLimit: 100,
      userAnswer: 'ユーザー解答',
    });
    expect(p).toContain('キーワード網羅');
    expect(p).toContain('Qテキスト');
    expect(p).toContain('モデル解答');
    expect(p).toContain('キーワード1、キーワード2');
    expect(p).toContain('100字以内');
    expect(p).toContain('ユーザー解答');
    expect(p).toContain('JSON');
  });

  it('buildShortAnswerPrompt: キーワード未指定時は「（指定なし）」', () => {
    const p = buildShortAnswerPrompt({
      perspective: SHORT_ANSWER_PERSPECTIVE_MAP.keyword_coverage,
      questionText: 'Q', modelAnswer: 'M', requiredKeywords: [], charLimit: 50, userAnswer: 'U',
    });
    expect(p).toContain('（指定なし）');
  });

  it('buildEssayPrompt: 必須要素を含む', () => {
    const p = buildEssayPrompt({
      perspective: ESSAY_PERSPECTIVE_MAP.question_alignment,
      examType: 'PM',
      theme: 'プロジェクトの進捗管理',
      subQuestion: 'イ',
      subQuestionRequirements: '課題と施策を述べよ',
      charMin: 800,
      charMax: 1600,
      scoringPoints: ['実現可能性', '具体性'],
      userAnswerForSubQuestion: '私が担当したプロジェクトでは...',
    });
    expect(p).toContain('PM午後II');
    expect(p).toContain('プロジェクトの進捗管理');
    expect(p).toContain('設問イ');
    expect(p).toContain('課題と施策を述べよ');
    expect(p).toContain('800〜1600 字');
    expect(p).toContain('- 実現可能性');
    expect(p).toContain('- 具体性');
    expect(p).toContain('私が担当したプロジェクトでは');
  });
});
