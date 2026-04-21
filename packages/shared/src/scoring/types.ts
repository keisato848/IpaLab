import { z } from 'zod';

/**
 * 午後試験 AI採点 共通型定義
 * 設計書: docs/02_design/14_AfternoonAIScoring_Rubric.md
 *         docs/02_design/15_AfternoonScoringAPI_v2.md
 */

// ---------- 形式判定 ----------

export const AfternoonFormats = {
  ShortAnswer: 'short_answer',
  Essay: 'essay',
  Choice: 'choice',
} as const;
export type AfternoonFormat = (typeof AfternoonFormats)[keyof typeof AfternoonFormats];

export const EssayExamTypes = ['PM', 'SA', 'ST'] as const;
export type EssayExamType = (typeof EssayExamTypes)[number];

export const ShortAnswerExamSlots = ['AP_PM', 'SC_PM', 'PM_PM1', 'SA_PM1', 'ST_PM1'] as const;
export type ShortAnswerExamSlot = (typeof ShortAnswerExamSlots)[number];

// ---------- 系統A: 記述式 ----------

export const ShortAnswerPerspectiveIds = [
  'keyword_coverage',
  'logical_structure',
  'expression_accuracy',
  'conciseness',
] as const;
export type ShortAnswerPerspectiveId = (typeof ShortAnswerPerspectiveIds)[number];

export interface ShortAnswerPerspectiveDef {
  id: ShortAnswerPerspectiveId;
  name: string;
  weight: number; // 0-1, 合計 1.0
  criteria: string;
}

export const ShortAnswerPerspectiveScoreSchema = z.object({
  id: z.enum(ShortAnswerPerspectiveIds),
  name: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  rationale: z.string(),
  matchedKeywords: z.array(z.string()).optional(),
  missingKeywords: z.array(z.string()).optional(),
});
export type ShortAnswerPerspectiveScore = z.infer<typeof ShortAnswerPerspectiveScoreSchema>;

export const ModelAnswerDiffSchema = z.object({
  additions: z.array(z.string()),
  deletions: z.array(z.string()),
  rephrasing: z.array(z.object({ user: z.string(), model: z.string() })),
});
export type ModelAnswerDiff = z.infer<typeof ModelAnswerDiffSchema>;

export const ShortAnswerScoringResultSchema = z.object({
  questionId: z.string(),
  format: z.literal('short_answer'),
  scoringVersion: z.string(),
  scoredAt: z.string(),
  totalScore: z.number(),
  maxScore: z.number(),
  perspectiveScores: z.array(ShortAnswerPerspectiveScoreSchema),
  modelAnswerDiff: ModelAnswerDiffSchema.optional(),
});
export type ShortAnswerScoringResult = z.infer<typeof ShortAnswerScoringResultSchema>;

// ---------- 系統B: 論述式 ----------

export const EssayPerspectiveIds = [
  'question_alignment',
  'logical_composition',
  'concreteness_experience',
  'feasibility_validity',
  'character_count_compliance',
  'expression_quality',
] as const;
export type EssayPerspectiveId = (typeof EssayPerspectiveIds)[number];

export const EssaySubQuestions = ['ア', 'イ', 'ウ'] as const;
export type EssaySubQuestion = (typeof EssaySubQuestions)[number];

export const EssayRanks = ['A', 'B', 'C', 'D'] as const;
export type EssayRank = (typeof EssayRanks)[number];

export interface EssayPerspectiveDef {
  id: EssayPerspectiveId;
  name: string;
  weight: number;
  criteria: string;
}

export interface EssaySubQuestionWeight {
  subQuestion: EssaySubQuestion;
  weight: number; // 例: 0.25 / 0.45 / 0.30
  charMin: number;
  charMax: number;
}

export const EssayPerspectiveScoreSchema = z.object({
  id: z.enum(EssayPerspectiveIds),
  name: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number(),
  rationale: z.string(),
  evidenceQuotes: z.array(z.string()).optional(),
  improvementHint: z.string().optional(),
});
export type EssayPerspectiveScore = z.infer<typeof EssayPerspectiveScoreSchema>;

export const EssaySubQuestionScoreSchema = z.object({
  subQuestion: z.enum(EssaySubQuestions),
  score: z.number().min(0).max(100),
  weight: z.number(),
  perspectiveScores: z.array(EssayPerspectiveScoreSchema),
});
export type EssaySubQuestionScore = z.infer<typeof EssaySubQuestionScoreSchema>;

export const EssayScoringResultSchema = z.object({
  questionId: z.string(),
  format: z.literal('essay'),
  scoringVersion: z.string(),
  scoredAt: z.string(),
  examType: z.enum(EssayExamTypes),
  overallRank: z.enum(EssayRanks),
  overallScore: z.number().min(0).max(100),
  characterCounts: z.object({
    setsumonA: z.number().int().min(0),
    setsumonI: z.number().int().min(0),
    setsumonU: z.number().int().min(0),
  }),
  subQuestionScores: z.array(EssaySubQuestionScoreSchema),
  overallFeedback: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    nextActions: z.array(z.string()),
  }),
});
export type EssayScoringResult = z.infer<typeof EssayScoringResultSchema>;

// ---------- 共通 union ----------

export type AfternoonScoringResult = ShortAnswerScoringResult | EssayScoringResult;

// ---------- 設問メタデータ（採点入力） ----------

export const ShortAnswerQuestionMetaSchema = z.object({
  questionId: z.string(),
  format: z.literal('short_answer'),
  examSlot: z.enum(ShortAnswerExamSlots),
  questionText: z.string(),
  modelAnswer: z.string(),
  requiredKeywords: z.array(z.string()),
  charLimit: z.number().int().positive(),
  maxScore: z.number().positive(),
});
export type ShortAnswerQuestionMeta = z.infer<typeof ShortAnswerQuestionMetaSchema>;

export const EssaySubQuestionMetaSchema = z.object({
  subQuestion: z.enum(EssaySubQuestions),
  requirements: z.string(),
  charMin: z.number().int().min(0),
  charMax: z.number().int().positive(),
  scoringPoints: z.array(z.string()),
  weight: z.number().min(0).max(1),
});
export type EssaySubQuestionMeta = z.infer<typeof EssaySubQuestionMetaSchema>;

export const EssayQuestionMetaSchema = z.object({
  questionId: z.string(),
  format: z.literal('essay'),
  examType: z.enum(EssayExamTypes),
  theme: z.string(),
  subQuestions: z.array(EssaySubQuestionMetaSchema).length(3),
});
export type EssayQuestionMeta = z.infer<typeof EssayQuestionMetaSchema>;

export type AfternoonQuestionMeta = ShortAnswerQuestionMeta | EssayQuestionMeta;

// ---------- 採点バージョン ----------

export const SCORING_VERSION = '2026.04.1';
