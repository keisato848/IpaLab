import { z } from 'zod';

/** GET /api/mobile/v1/bootstrap 応答（詳細設計§6） */
export const bootstrapResponseSchema = z.object({
    contentVersion: z.string().min(1),
    syncCursor: z.string().nullable(),
    featureFlags: z.record(z.boolean()),
    minSupportedAppVersion: z.string().min(1),
    serverTime: z.string().datetime(),
});
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;

/** GET /api/mobile/v1/content/manifest 応答（日次差分更新、基本設計§7.2） */
export const contentManifestEntrySchema = z.object({
    examId: z.string().min(1),
    title: z.string().min(1),
    year: z.number().int(),
    type: z.string().min(1),
    category: z.string().min(1),
    questionCount: z.number().int().nonnegative(),
    contentHash: z.string().min(1),
    updatedAt: z.string().datetime(),
});
export type ContentManifestEntry = z.infer<typeof contentManifestEntrySchema>;

export const contentManifestResponseSchema = z.object({
    contentVersion: z.string().min(1),
    exams: z.array(contentManifestEntrySchema),
});
export type ContentManifestResponse = z.infer<typeof contentManifestResponseSchema>;

/** GET /api/mobile/v1/content/exams/{examId} 応答（0件・hash不一致時はキャッシュ破棄禁止、詳細設計§8） */
export const examContentResponseSchema = z.object({
    examId: z.string().min(1),
    contentHash: z.string().min(1),
    questions: z
        .array(
            z.object({
                id: z.string().min(1),
                qNo: z.number().int().positive(),
                category: z.string(),
                questionText: z.string().min(1),
                choices: z.array(z.string()).optional(),
                correctAnswer: z.string().optional(),
                explanation: z.string().optional(),
            })
        )
        .min(1),
});
export type ExamContentResponse = z.infer<typeof examContentResponseSchema>;
