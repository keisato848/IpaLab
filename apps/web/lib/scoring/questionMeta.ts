/**
 * 採点API用 設問メタデータ取得
 *
 * 本実装はリポジトリの実データ層 (#176 完成時に Cosmos / 静的データに接続) と切り離し、
 * テストおよび暫定動作のためのインメモリ実装を提供する。
 *
 * `setQuestionMetaProvider()` で本番接続を後から差し替え可能。
 */

import { Scoring } from '@ipa-lab/shared';
type KeywordEntry = Scoring.KeywordEntry;

export interface ShortAnswerQuestionMeta {
  questionId: string;
  questionText: string;
  modelAnswer: string;
  charLimit: number;
  scoringPoints: string[];
  requiredKeywords: KeywordEntry[];
  /** 設問配点 (0-100 スコアからスケーリングする際の上限) */
  questionMaxScore: number;
}

export interface EssayQuestionMeta {
  questionId: string;
  examType: 'PM' | 'SA' | 'ST';
  theme: string;
  /** 小問ア/イ/ウの本文要件 */
  subQuestions: {
    A: { requirements: string; charMin: number; charMax: number; scoringPoints: string[] };
    I: { requirements: string; charMin: number; charMax: number; scoringPoints: string[] };
    U: { requirements: string; charMin: number; charMax: number; scoringPoints: string[] };
  };
}

export type QuestionMetaProvider = {
  getShortAnswer: (questionId: string) => Promise<ShortAnswerQuestionMeta | null>;
  getEssay: (questionId: string) => Promise<EssayQuestionMeta | null>;
};

let provider: QuestionMetaProvider = createDefaultStubProvider();

export function setQuestionMetaProvider(p: QuestionMetaProvider): void {
  provider = p;
}

export function getQuestionMetaProvider(): QuestionMetaProvider {
  return provider;
}

/**
 * デフォルトのスタブ provider。
 * `SHORT_ANSWER_KEYWORD_DICTIONARY` に存在する questionId のみ返す（暫定）。
 * 本番では Cosmos DB から取得する provider に差し替える (#176 完了 → #190 で本接続)。
 */
function createDefaultStubProvider(): QuestionMetaProvider {
  return {
    async getShortAnswer(questionId: string) {
      const required = Scoring.getRequiredKeywords(questionId);
      if (required.length === 0) return null;
      return {
        questionId,
        questionText: `[stub] 設問 ${questionId} の本文`,
        modelAnswer: `[stub] ${questionId} の模範解答`,
        charLimit: 50,
        scoringPoints: [],
        requiredKeywords: required,
        questionMaxScore: 8,
      };
    },
    async getEssay(_questionId: string) {
      return null;
    },
  };
}
