import { z } from 'zod';

/** 同期バッチの最大イベント数（基本設計§5.3 / 詳細設計§8） */
export const SYNC_BATCH_MAX_EVENTS = 50;

/** Mobile API 共通ヘッダー名（詳細設計§6） */
export const MOBILE_HEADERS = {
    correlationId: 'X-Correlation-Id',
    deviceId: 'X-Device-Id',
    appVersion: 'X-App-Version',
} as const;

/** Mobile API 共通エラー応答（詳細設計§6） */
export const mobileApiErrorSchema = z.object({
    code: z.string().min(1),
    message: z.string(),
    retryable: z.boolean(),
    correlationId: z.string().min(1),
});
export type MobileApiError = z.infer<typeof mobileApiErrorSchema>;

/** 同期イベントの適用結果（詳細設計§6） */
export const syncEventResultStatusSchema = z.enum([
    'applied',
    'duplicate',
    'conflict',
    'rejected',
    'retryable_error',
]);
export type SyncEventResultStatus = z.infer<typeof syncEventResultStatusSchema>;
