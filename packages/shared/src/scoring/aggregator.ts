import {
  EssayPerspectiveScore,
  EssaySubQuestion,
  EssaySubQuestionScore,
  ShortAnswerPerspectiveScore,
} from './types';
import {
  ESSAY_SUB_QUESTION_WEIGHTS,
  scoreToRank,
} from './rubrics/essay';
import { SHORT_ANSWER_RUBRIC } from './rubrics/shortAnswer';

/**
 * 採点結果アグリゲータ
 *
 * バックエンド (#176) は LLM 観点別呼び出しを並列実行し、結果が揃ったタイミングで
 * 本モジュールを使って加重平均・ランク判定を行う。フロントエンドからも、
 * SSE で部分到着した観点スコアの暫定合計表示に再利用できる。
 */

// ---------- 系統A ----------

/**
 * 系統A: 観点別スコアから 0-100 の加重平均を算出
 * - perspectiveScores 内の `weight` を信頼するが、合計が 1.0 から大きくずれていた場合は
 *   `weight` 比率で正規化する（順序ロバスト性のため）
 */
export function aggregateShortAnswerScore(
  perspectiveScores: ShortAnswerPerspectiveScore[],
): { weightedScore: number; coverage: number } {
  if (perspectiveScores.length === 0) {
    return { weightedScore: 0, coverage: 0 };
  }
  const weightSum = perspectiveScores.reduce((s, p) => s + p.weight, 0);
  if (weightSum <= 0) return { weightedScore: 0, coverage: 0 };
  const weighted = perspectiveScores.reduce(
    (s, p) => s + (p.score * p.weight) / weightSum,
    0,
  );
  // ルーブリック上の総観点数に対するカバー率（部分到着時の進捗表示に使う）
  const coverage = perspectiveScores.length / SHORT_ANSWER_RUBRIC.length;
  return { weightedScore: round1(weighted), coverage };
}

/**
 * 0-100 の加重スコアを設問配点 (maxScore) にスケーリング
 */
export function scaleToQuestionScore(
  weightedScore0to100: number,
  maxScore: number,
): number {
  return round1((weightedScore0to100 / 100) * maxScore);
}

// ---------- 系統B ----------

/**
 * 系統B: 1小問内の観点別スコア → 小問スコア（0-100）
 */
export function aggregateEssaySubQuestionScore(
  perspectiveScores: EssayPerspectiveScore[],
): number {
  if (perspectiveScores.length === 0) return 0;
  const weightSum = perspectiveScores.reduce((s, p) => s + p.weight, 0);
  if (weightSum <= 0) return 0;
  const weighted = perspectiveScores.reduce(
    (s, p) => s + (p.score * p.weight) / weightSum,
    0,
  );
  return round1(weighted);
}

/**
 * 系統B: 小問スコア配列 → 全体スコア（0-100）+ ランク（A/B/C/D）
 *
 * 字数違反・設問欠落のハードペナルティ:
 *  - いずれかの小問で character_count_compliance が 0 点 → 上限を C にクリップ（不合格相当）
 *  - いずれかの小問で question_alignment が 0 点 → 上限を D に強制（設問落とし）
 */
export function aggregateEssayOverall(
  subQuestionScores: EssaySubQuestionScore[],
): { overallScore: number; overallRank: 'A' | 'B' | 'C' | 'D' } {
  if (subQuestionScores.length === 0) {
    return { overallScore: 0, overallRank: 'D' };
  }
  // 重みは ESSAY_SUB_QUESTION_WEIGHTS を参照（subQuestionScores 内 weight が壊れていても安全側）
  const weightMap: Record<EssaySubQuestion, number> = {
    ア: 0,
    イ: 0,
    ウ: 0,
  };
  for (const w of ESSAY_SUB_QUESTION_WEIGHTS) weightMap[w.subQuestion] = w.weight;

  const presentWeightSum = subQuestionScores.reduce(
    (s, q) => s + (weightMap[q.subQuestion] ?? 0),
    0,
  );
  if (presentWeightSum <= 0) return { overallScore: 0, overallRank: 'D' };

  const weighted = subQuestionScores.reduce(
    (s, q) => s + (q.score * (weightMap[q.subQuestion] ?? 0)) / presentWeightSum,
    0,
  );
  let overallScore = round1(weighted);
  let overallRank = scoreToRank(overallScore);

  // ハードペナルティ
  for (const sq of subQuestionScores) {
    const charScore = sq.perspectiveScores.find(
      (p) => p.id === 'character_count_compliance',
    )?.score;
    const alignScore = sq.perspectiveScores.find(
      (p) => p.id === 'question_alignment',
    )?.score;

    if (alignScore !== undefined && alignScore === 0) {
      overallRank = 'D';
      overallScore = Math.min(overallScore, 39);
      break;
    }
    if (charScore !== undefined && charScore === 0) {
      if (overallRank === 'A' || overallRank === 'B') {
        overallRank = 'C';
        overallScore = Math.min(overallScore, 59);
      }
    }
  }

  return { overallScore, overallRank };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
