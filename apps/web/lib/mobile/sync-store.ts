/**
 * 同期イベント受信（詳細設計§6 / §8）
 * - コンテナ: MobileSyncEvents（PK /userId）
 * - eventId冪等: 既存IDは 'duplicate'
 * - 部分ACK: イベント単位で applied / duplicate / rejected / retryable_error
 * - 認可: JWTのsubを正本とし、payload内のuserIdは無視する
 */
import { getContainer } from '@/lib/cosmos';
import { Mobile } from '@ipa-lab/shared';

/** 端末時計の改ざん・狂いを拒否する許容スキュー */
const FUTURE_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export interface SyncEventDoc {
    id: string;
    userId: string;
    type: string;
    occurredAt: string;
    payload: Record<string, unknown>;
    schemaVersion: number;
    receivedAt: string;
    _ts?: number;
}

async function requireContainer() {
    const container = await getContainer('MobileSyncEvents');
    if (!container) throw new Error('MobileSyncEvents container not initialized');
    return container;
}

function isCosmosConflict(error: unknown): boolean {
    const e = error as { code?: number | string; statusCode?: number };
    return e.statusCode === 409 || e.code === 409 || e.code === '409';
}

export async function applySyncEvent(userId: string, event: Mobile.SyncEvent): Promise<Mobile.SyncEventResult> {
    // 未来時刻のイベントは拒否（再送しても直らないため rejected）
    if (new Date(event.occurredAt).getTime() > Date.now() + FUTURE_SKEW_TOLERANCE_MS) {
        return { eventId: event.eventId, status: 'rejected', message: 'occurredAtが未来時刻です' };
    }

    const container = await requireContainer();
    const doc: SyncEventDoc = {
        id: event.eventId,
        userId,
        type: event.type,
        occurredAt: event.occurredAt,
        payload: event.payload,
        schemaVersion: event.schemaVersion,
        receivedAt: new Date().toISOString(),
    };

    try {
        // create はID重複で409を返すため、それ自体が冪等チェックを兼ねる
        await container.items.create(doc);
        return { eventId: event.eventId, status: 'applied' };
    } catch (error) {
        if (isCosmosConflict(error)) {
            return { eventId: event.eventId, status: 'duplicate' };
        }
        console.error('[mobile/sync] event apply failed:', event.eventId, error);
        return { eventId: event.eventId, status: 'retryable_error', message: '一時的に保存できませんでした' };
    }
}

/** イベント単位の部分ACK。1件の失敗で他イベントを失敗させない。 */
export async function applySyncBatch(
    userId: string,
    events: Mobile.SyncEvent[]
): Promise<Mobile.SyncEventResult[]> {
    const results: Mobile.SyncEventResult[] = [];
    for (const event of events) {
        results.push(await applySyncEvent(userId, event));
    }
    return results;
}

/**
 * サーバー差分pull（他端末から同期されたイベント）。
 * cursorは_ts（Cosmos更新エポック秒）の文字列。
 */
export async function fetchChanges(
    userId: string,
    cursor: string | undefined,
    limit: number
): Promise<Mobile.SyncChangesResponse> {
    const container = await requireContainer();
    const since = cursor ? Number(cursor) : 0;
    const { resources } = await container.items
        .query<SyncEventDoc>({
            query: 'SELECT * FROM c WHERE c.userId = @userId AND c._ts > @since ORDER BY c._ts ASC',
            parameters: [
                { name: '@userId', value: userId },
                { name: '@since', value: Number.isFinite(since) ? since : 0 },
            ],
        })
        .fetchAll();

    const page = resources.slice(0, limit);
    const last = page[page.length - 1];
    return Mobile.syncChangesResponseSchema.parse({
        changes: page.map((doc) => ({
            entityType: 'learning_record' as const,
            entityId: doc.id,
            updatedAt: doc.receivedAt,
            data: { type: doc.type, occurredAt: doc.occurredAt, payload: doc.payload },
        })),
        nextCursor: last?._ts != null ? String(last._ts) : (cursor ?? null),
        hasMore: resources.length > limit,
    });
}
