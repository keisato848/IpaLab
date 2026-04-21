import {
  EssayPerspectiveDef,
  EssayPerspectiveId,
  EssayRank,
  EssaySubQuestionWeight,
} from '../types';

/**
 * 系統B: 論述式ルーブリック
 * 設計書 §4 / docs/02_design/14_AfternoonAIScoring_Rubric.md
 *
 * 配点比率: question_alignment 25% / logical_composition 20% /
 *          concreteness_experience 20% / feasibility_validity 15% /
 *          character_count_compliance 10% / expression_quality 10% = 1.00
 */
export const ESSAY_RUBRIC: readonly EssayPerspectiveDef[] = [
  {
    id: 'question_alignment',
    name: '設問要求への適合',
    weight: 0.25,
    criteria:
      '設問ア・イ・ウの各設問が問うている内容に正面から答えているかを評価する（論点ズレ・設問落としの検出）。',
  },
  {
    id: 'logical_composition',
    name: '論理構成',
    weight: 0.2,
    criteria:
      '背景→課題→施策→効果の論理展開、章立ての明瞭性、主張の一貫性を評価する。',
  },
  {
    id: 'concreteness_experience',
    name: '具体性・実体験性',
    weight: 0.2,
    criteria:
      '自身の関与・役職・プロジェクト規模・固有名詞・数値の明示を評価する。抽象的・一般論への減点。',
  },
  {
    id: 'feasibility_validity',
    name: '実現可能性・妥当性',
    weight: 0.15,
    criteria:
      '提案施策が現実的か、技術的・組織的に矛盾がないか、専門家視点で破綻していないかを評価する。',
  },
  {
    id: 'character_count_compliance',
    name: '字数要件の遵守',
    weight: 0.1,
    criteria: '設問ごとの字数下限・上限の遵守を評価する。',
  },
  {
    id: 'expression_quality',
    name: '表現品質',
    weight: 0.1,
    criteria:
      '誤字脱字・主述対応・冗長表現・論文として読みやすい文体を評価する。',
  },
] as const;

export const ESSAY_PERSPECTIVE_MAP: Readonly<
  Record<EssayPerspectiveId, EssayPerspectiveDef>
> = Object.freeze(
  Object.fromEntries(ESSAY_RUBRIC.map((p) => [p.id, p])) as Record<
    EssayPerspectiveId,
    EssayPerspectiveDef
  >,
);

/**
 * 設問ア・イ・ウの重みと字数要件
 * IPA論述式の標準構成: 設問ア 800字以内 / 設問イ 800-1600字 / 設問ウ 600-1200字
 * 重みは設問イを最重視（実務での主たる論述）
 */
export const ESSAY_SUB_QUESTION_WEIGHTS: readonly EssaySubQuestionWeight[] = [
  { subQuestion: 'ア', weight: 0.25, charMin: 0, charMax: 800 },
  { subQuestion: 'イ', weight: 0.45, charMin: 800, charMax: 1600 },
  { subQuestion: 'ウ', weight: 0.3, charMin: 600, charMax: 1200 },
] as const;

/**
 * 総合スコアからIPAランク（A/B/C/D）への変換境界
 * 設計書 §4.2
 *  A: 設問要求を充足し具体性・実現性が高い   (合格)
 *  B: 一部に弱点があるが概ね妥当             (合格)
 *  C: 設問要求の充足が不十分                 (不合格)
 *  D: 設問要求を満たしていない / 字数不足    (不合格)
 */
export interface RankBoundary {
  rank: EssayRank;
  minScore: number; // この点以上
}
export const ESSAY_RANK_BOUNDARIES: readonly RankBoundary[] = [
  { rank: 'A', minScore: 80 },
  { rank: 'B', minScore: 60 },
  { rank: 'C', minScore: 40 },
  { rank: 'D', minScore: 0 },
] as const;

export function scoreToRank(score: number): EssayRank {
  for (const b of ESSAY_RANK_BOUNDARIES) {
    if (score >= b.minScore) return b.rank;
  }
  return 'D';
}
