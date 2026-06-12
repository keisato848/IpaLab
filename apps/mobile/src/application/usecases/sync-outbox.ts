/**
 * Outbox同期ユースケース（詳細設計§8）
 * - leaseを取得して最大50件送信、部分ACKを状態機械へ反映
 * - eventIdは再送時も変更しない
 * - 依存はポート注入（テスト・実装差し替えのため）
 */
import {
    transitionOnServerResult,
    transitionOnTransportFailure,
    type ServerEventStatus,
} from '../../domain/policies/outbox-state';

export const SYNC_BATCH_LIMIT = 50;

export interface OutboxItem {
    eventId: string;
    attemptCount: number;
}

export interface SyncEventPayload {
    eventId: string;
    type: string;
    occurredAt: string;
    payload: Record<string, unknown>;
    schemaVersion: number;
}

export interface OutboxPort {
    /** pendingをin_flightへ更新しlease済みイベントを返す（上限limit） */
    leasePending(limit: number): Promise<OutboxItem[]>;
    loadEvents(eventIds: string[]): Promise<SyncEventPayload[]>;
    /** 状態遷移を永続化する */
    applyTransition(
        eventId: string,
        nextState: string,
        options: { retryAfterSeconds?: number; incrementAttempt: boolean }
    ): Promise<void>;
}

export interface SyncApiPort {
    /** POST /api/mobile/v1/sync/batch。HTTPエラー・通信断は例外を投げる */
    sendBatch(events: SyncEventPayload[]): Promise<{ eventId: string; status: ServerEventStatus }[]>;
}

export interface SyncOutboxResult {
    sent: number;
    acknowledged: number;
    conflicts: number;
    deadLetters: number;
    retries: number;
}

export async function syncOutbox(outbox: OutboxPort, api: SyncApiPort): Promise<SyncOutboxResult> {
    const result: SyncOutboxResult = { sent: 0, acknowledged: 0, conflicts: 0, deadLetters: 0, retries: 0 };

    const leased = await outbox.leasePending(SYNC_BATCH_LIMIT);
    if (leased.length === 0) return result;

    const attemptByEventId = new Map(leased.map((i) => [i.eventId, i.attemptCount]));
    const events = await outbox.loadEvents(leased.map((i) => i.eventId));
    result.sent = events.length;

    let responses: { eventId: string; status: ServerEventStatus }[];
    try {
        responses = await api.sendBatch(events);
    } catch {
        // バッチ全体失敗: 送達不明のため全件をeventId維持のまま再試行系へ
        for (const item of leased) {
            const t = transitionOnTransportFailure(item.attemptCount);
            await outbox.applyTransition(item.eventId, t.nextState, {
                retryAfterSeconds: t.retryAfterSeconds,
                incrementAttempt: t.incrementAttempt,
            });
            if (t.nextState === 'dead_letter') result.deadLetters += 1;
            else result.retries += 1;
        }
        return result;
    }

    const respondedIds = new Set<string>();
    for (const res of responses) {
        const attemptCount = attemptByEventId.get(res.eventId);
        if (attemptCount === undefined) continue; // 未知のeventIdは無視
        respondedIds.add(res.eventId);

        const t = transitionOnServerResult(res.status, attemptCount);
        await outbox.applyTransition(res.eventId, t.nextState, {
            retryAfterSeconds: t.retryAfterSeconds,
            incrementAttempt: t.incrementAttempt,
        });
        if (t.nextState === 'acknowledged') result.acknowledged += 1;
        else if (t.nextState === 'conflict') result.conflicts += 1;
        else if (t.nextState === 'dead_letter') result.deadLetters += 1;
        else result.retries += 1;
    }

    // 応答に含まれないイベントは送達不明として再試行系へ
    for (const item of leased) {
        if (respondedIds.has(item.eventId)) continue;
        const t = transitionOnTransportFailure(item.attemptCount);
        await outbox.applyTransition(item.eventId, t.nextState, {
            retryAfterSeconds: t.retryAfterSeconds,
            incrementAttempt: t.incrementAttempt,
        });
        if (t.nextState === 'dead_letter') result.deadLetters += 1;
        else result.retries += 1;
    }

    return result;
}
