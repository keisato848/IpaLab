/**
 * Outbox状態機械（詳細設計§8)
 *
 * pending -> in_flight -> acknowledged
 *                     -> conflict
 *                     -> dead_letter
 *                     -> retry_wait -> pending
 *
 * - 8回失敗しても削除せず保留（手動同期/次回起動で再開）
 * - acknowledged は監査のため7日保持
 */
import { nextBackoffSeconds, shouldSuspendRetry } from './backoff';

export type OutboxState =
    | 'pending'
    | 'in_flight'
    | 'acknowledged'
    | 'conflict'
    | 'dead_letter'
    | 'retry_wait';

/** サーバーの部分ACK結果（共有DTO syncEventResultStatusSchema と一致させる） */
export type ServerEventStatus = 'applied' | 'duplicate' | 'conflict' | 'rejected' | 'retryable_error';

export const ACKNOWLEDGED_RETENTION_DAYS = 7;

export interface OutboxTransition {
    nextState: OutboxState;
    /** retry_wait時のみ: 次回試行までの待機秒数 */
    retryAfterSeconds?: number;
    /** attempt_countを増分するか */
    incrementAttempt: boolean;
}

/**
 * サーバー応答（イベント単位）による遷移。
 * - applied/duplicate: 同期完了（duplicateは再送が先に届いたケースで正常）
 * - conflict: 競合テーブルへ記録しUI通知（詳細設計§8.1）
 * - rejected: 再送しても直らないためdead_letter
 * - retryable_error: バックオフ後に再試行。8回で保留
 */
export function transitionOnServerResult(status: ServerEventStatus, attemptCount: number): OutboxTransition {
    switch (status) {
        case 'applied':
        case 'duplicate':
            return { nextState: 'acknowledged', incrementAttempt: false };
        case 'conflict':
            return { nextState: 'conflict', incrementAttempt: false };
        case 'rejected':
            return { nextState: 'dead_letter', incrementAttempt: false };
        case 'retryable_error':
            return transitionOnTransportFailure(attemptCount);
    }
}

/** 通信断・5xx等のバッチ全体失敗時の遷移（イベントは送達不明のためeventId維持で再送） */
export function transitionOnTransportFailure(attemptCount: number): OutboxTransition {
    const nextAttempt = attemptCount + 1;
    if (shouldSuspendRetry(nextAttempt)) {
        return { nextState: 'dead_letter', incrementAttempt: true };
    }
    return {
        nextState: 'retry_wait',
        retryAfterSeconds: nextBackoffSeconds(nextAttempt),
        incrementAttempt: true,
    };
}

/** 期限到来したretry_waitをpendingへ戻す */
export function shouldResume(state: OutboxState, nextAttemptAt: string | null, now: Date): boolean {
    return state === 'retry_wait' && nextAttemptAt != null && nextAttemptAt <= now.toISOString();
}

/** 監査保持期限を過ぎたacknowledgedは削除可 */
export function canPurgeAcknowledged(acknowledgedAt: string, now: Date): boolean {
    const limit = new Date(now.getTime() - ACKNOWLEDGED_RETENTION_DAYS * 86400_000);
    return new Date(acknowledgedAt) < limit;
}
