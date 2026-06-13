/**
 * ゲスト→正式アカウント統合（詳細設計§5.3）
 * - guest credential（sha256照合）で所有を証明
 * - 固定mergeIdで冪等（再実行・クラッシュ後再開で二重移管しない）
 * - 同一guestの別アカウントへの統合は拒否（横取り防止）
 * - 統合後はゲストのセッションを失効し、credentialをmerged扱いにする
 * - コンテナ: MobileGuestMerges（PK /userId）
 */
import { createHash, timingSafeEqual } from 'crypto';
import { getContainer } from '@/lib/cosmos';
import { Mobile } from '@ipa-lab/shared';
import type { SyncEventDoc } from './sync-store';
import type { MobileSessionDoc } from './session-store';

interface GuestMergeDoc {
    id: string;
    /** PK = 統合先ユーザーID */
    userId: string;
    docType: 'guest_merge';
    guestId: string;
    status: 'completed';
    mergedEventCount: number;
    completedAt: string;
}

interface GuestCredentialDoc {
    id: string;
    userId: string;
    docType: 'guest_credential';
    secretHash: string;
    merged?: boolean;
}

export type MergeOutcome =
    | { status: 'completed' | 'already_merged'; mergedEventCount: number }
    | { status: 'rejected'; reason: 'invalid_credential' | 'guest_taken' };

function secretMatches(storedHash: string, presented: string): boolean {
    const a = Buffer.from(storedHash, 'hex');
    const b = Buffer.from(createHash('sha256').update(presented).digest('hex'), 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
}

function isCosmosConflict(error: unknown): boolean {
    const e = error as { code?: number | string; statusCode?: number };
    return e.statusCode === 409 || e.code === 409 || e.code === '409';
}

export async function mergeGuest(
    targetUserId: string,
    request: Mobile.GuestMergeRequest
): Promise<MergeOutcome> {
    const sessions = await getContainer('MobileSessions');
    const merges = await getContainer('MobileGuestMerges');
    const events = await getContainer('MobileSyncEvents');
    if (!sessions || !merges || !events) throw new Error('DB not ready');

    const guestUserId = `guest:${request.guestId}`;

    // 1. credential検証（所有証明）
    const { resources: creds } = await sessions.items
        .query<GuestCredentialDoc>({
            query: "SELECT * FROM c WHERE c.id = @id AND c.docType = 'guest_credential'",
            parameters: [{ name: '@id', value: `cred:${request.guestId}` }],
        })
        .fetchAll();
    const cred = creds[0];
    if (!cred || !secretMatches(cred.secretHash, request.guestSecret)) {
        return { status: 'rejected', reason: 'invalid_credential' };
    }

    // 2. 冪等・横取りチェック（同一guestIdの統合履歴を全パーティションから取得）
    const { resources: priorMerges } = await merges.items
        .query<GuestMergeDoc>({
            query: "SELECT * FROM c WHERE c.guestId = @guestId AND c.docType = 'guest_merge'",
            parameters: [{ name: '@guestId', value: request.guestId }],
        })
        .fetchAll();
    const prior = priorMerges[0];
    if (prior) {
        if (prior.userId === targetUserId && prior.id === request.mergeId) {
            return { status: 'already_merged', mergedEventCount: prior.mergedEventCount };
        }
        // 別アカウント・別mergeIdへの統合は拒否
        return { status: 'rejected', reason: 'guest_taken' };
    }

    // 3. ゲストの同期イベントを統合先へ移管（再実行に耐えるようcreate 409は移管済みとして扱う）
    const { resources: guestEvents } = await events.items
        .query<SyncEventDoc>({
            query: 'SELECT * FROM c WHERE c.userId = @userId',
            parameters: [{ name: '@userId', value: guestUserId }],
        })
        .fetchAll();

    let movedCount = 0;
    for (const doc of guestEvents) {
        try {
            await events.items.create({ ...doc, userId: targetUserId, _ts: undefined });
            movedCount += 1;
        } catch (error) {
            if (!isCosmosConflict(error)) throw error;
            movedCount += 1; // 前回実行で移管済み
        }
        await events.item(doc.id, guestUserId).delete();
    }

    // 4. ゲストのセッションを全失効・credentialをmerged化
    const { resources: guestSessions } = await sessions.items
        .query<MobileSessionDoc>({
            query: "SELECT * FROM c WHERE c.userId = @userId AND c.docType = 'session' AND IS_NULL(c.revokedAt)",
            parameters: [{ name: '@userId', value: guestUserId }],
        })
        .fetchAll();
    const revokedAt = new Date().toISOString();
    for (const s of guestSessions) {
        await sessions.items.upsert({ ...s, revokedAt });
    }
    await sessions.items.upsert({ ...cred, merged: true });

    // 5. 統合記録（完了ACKの根拠。これ以降クライアントはローカルのゲスト領域を削除可）
    const record: GuestMergeDoc = {
        id: request.mergeId,
        userId: targetUserId,
        docType: 'guest_merge',
        guestId: request.guestId,
        status: 'completed',
        mergedEventCount: movedCount,
        completedAt: revokedAt,
    };
    try {
        await merges.items.create(record);
    } catch (error) {
        if (!isCosmosConflict(error)) throw error;
    }
    return { status: 'completed', mergedEventCount: movedCount };
}
