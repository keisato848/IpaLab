import {
  ShortAnswerPerspectiveDef,
  ShortAnswerPerspectiveId,
} from '../types';

/**
 * 系統A: 記述式ルーブリック
 * 設計書 §3 / docs/02_design/14_AfternoonAIScoring_Rubric.md
 *
 * 配点比率: keyword_coverage 40% / logical_structure 25% /
 *          expression_accuracy 20% / conciseness 15%   = 1.00
 */
export const SHORT_ANSWER_RUBRIC: readonly ShortAnswerPerspectiveDef[] = [
  {
    id: 'keyword_coverage',
    name: 'キーワード網羅',
    weight: 0.4,
    criteria: '模範解答に含まれる必須キーワードの被覆率を評価する。',
  },
  {
    id: 'logical_structure',
    name: '論理構造の妥当性',
    weight: 0.25,
    criteria: '因果関係・主述対応・解答全体の整合性を評価する。',
  },
  {
    id: 'expression_accuracy',
    name: '表現の正確性',
    weight: 0.2,
    criteria: '専門用語の正しい使用、誤用の有無を評価する。',
  },
  {
    id: 'conciseness',
    name: '字数・簡潔性',
    weight: 0.15,
    criteria: '制限字数の遵守、冗長表現の有無を評価する。',
  },
] as const;

export const SHORT_ANSWER_PERSPECTIVE_MAP: Readonly<
  Record<ShortAnswerPerspectiveId, ShortAnswerPerspectiveDef>
> = Object.freeze(
  Object.fromEntries(SHORT_ANSWER_RUBRIC.map((p) => [p.id, p])) as Record<
    ShortAnswerPerspectiveId,
    ShortAnswerPerspectiveDef
  >,
);
