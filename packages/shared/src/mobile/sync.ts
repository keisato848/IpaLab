import { z } from 'zod';
import { SYNC_BATCH_MAX_EVENTS, syncEventResultStatusSchema } from './common';

/** 学習履歴イベント種別（詳細設計§7 learning_events / §8.1 競合規則） */
export const learningEventTypeSchema = z.enum([
    'answer_submitted',
    'scoring_result_received',
    'session_started',
    'session_completed',
    'plan_task_completed',
    'preference_changed',
]);
export type LearningEventType = z.infer<typeof learningEventTypeSchema>;

/** 同期イベント（追記専用・event_idで冪等、基本設計§5.4） */
export const syncEventSchema = z.object({
    eventId: z.string().uuid(),
    type: learningEventTypeSchema,
    occurredAt: z.string().datetime(),
    /** スキーマ進化に備えイベント本体はtype別に検証する */
    payload: z.record(z.unknown()),
    schemaVersion: z.number().int().positive(),
});
export type SyncEvent = z.infer<typeof syncEventSchema>;

/** POST /api/mobile/v1/sync/batch 要求（最大50件、詳細設計§8） */
export const syncBatchRequestSchema = z.object({
    events: z.array(syncEventSchema).min(1).max(SYNC_BATCH_MAX_EVENTS),
});
export type SyncBatchRequest = z.infer<typeof syncBatchRequestSchema>;

/** イベントごとの部分ACK結果（詳細設計§6） */
export const syncEventResultSchema = z.object({
    eventId: z.string().uuid(),
    status: syncEventResultStatusSchema,
    message: z.string().optional(),
});
export type SyncEventResult = z.infer<typeof syncEventResultSchema>;

export const syncBatchResponseSchema = z.object({
    results: z.array(syncEventResultSchema),
    serverTime: z.string().datetime(),
});
export type SyncBatchResponse = z.infer<typeof syncBatchResponseSchema>;

/** GET /api/mobile/v1/sync/changes 要求・応答（サーバー差分pull） */
export const syncChangesQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.number().int().positive().max(200).default(100),
});
export type SyncChangesQuery = z.infer<typeof syncChangesQuerySchema>;

export const syncChangesResponseSchema = z.object({
    changes: z.array(
        z.object({
            entityType: z.enum(['learning_record', 'study_plan', 'preference']),
            entityId: z.string().min(1),
            updatedAt: z.string().datetime(),
            data: z.record(z.unknown()),
        })
    ),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
});
export type SyncChangesResponse = z.infer<typeof syncChangesResponseSchema>;
