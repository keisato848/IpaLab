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
/**
 * 暫定: 論述式のサンプル設問メタ（公開IPA過去問の要旨ベース）
 * 本番は Cosmos DB に格納し provider 差し替えで取得する。
 */
const ESSAY_STUB_DICTIONARY: Record<string, EssayQuestionMeta> = {
  'PM-2024A-PM2-q1': {
    questionId: 'PM-2024A-PM2-q1',
    examType: 'PM',
    theme: 'プロジェクト計画における利害関係者との調整',
    subQuestions: {
      A: {
        requirements:
          '関与したプロジェクトの概要、利害関係者の構成、調整が必要となった背景を 800 字以内で論述する。',
        charMin: 0,
        charMax: 800,
        scoringPoints: [
          'プロジェクトの目的・規模・体制が明示されている',
          '利害関係者の役割と利害対立の構図が説明されている',
        ],
      },
      I: {
        requirements:
          '利害関係者間で発生した課題と、PM として講じた具体的な調整施策、その実施プロセスを 800〜1600 字で論述する。',
        charMin: 800,
        charMax: 1600,
        scoringPoints: [
          '課題の本質的原因が分析されている',
          '取った施策が利害関係者ごとに具体的である',
          '実施プロセス（合意形成・意思決定の流れ）が時系列で示されている',
        ],
      },
      U: {
        requirements:
          '施策の評価と、改善すべき点・次回プロジェクトへの活かし方を 600〜1200 字で論述する。',
        charMin: 600,
        charMax: 1200,
        scoringPoints: [
          '定量的・定性的な評価指標で施策の効果を測定している',
          '反省点とその改善策が述べられている',
        ],
      },
    },
  },
};

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
    async getEssay(questionId: string) {
      // 暫定: 既知のサンプル設問のみ返す。本番では Cosmos から取得 (#190)。
      if (!ESSAY_STUB_DICTIONARY[questionId]) return null;
      return ESSAY_STUB_DICTIONARY[questionId];
    },
  };
}
