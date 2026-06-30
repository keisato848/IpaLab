/**
 * Mobile session（詳細設計§5.2 / §5.3）
 * - Refresh Token: `{sessionId}.{secret}` の自己完結形式。secretはSHA-256で保存。
 * - 絶対TTL 30日、無操作TTL 14日。
 * - rotation: 使用済みhashを保持し、再利用検知時はtoken familyを全失効する。
 * - コンテナ: MobileSessions（PK /userId）
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { getContainer } from '@/lib/cosmos';

export const REFRESH_ABSOLUTE_TTL_DAYS = 30;
export const REFRESH_INACTIVITY_TTL_DAYS = 14;

export interface MobileSessionDoc {
    id: string;
    /** PK。OAuthユーザーIDまたは `guest:{guestId}` */
    userId: string;
    docType: 'session';
    authType: 'oauth' | 'guest';
    provider?: string;
    familyId: string;
    refreshTokenHash: string;
    usedTokenHashes: string[];
    absoluteExpiresAt: string;
    inactivityExpiresAt: string;
    revokedAt: string | null;
    createdAt: string;
    lastUsedAt: string;
}

export type RefreshResult =
    | { ok: true; session: MobileSessionDoc; refreshToken: string }
    | { ok: false; reason: 'invalid' | 'expired' | 'revoked' | 'reused' };

function hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
}

function hashesEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function buildRefreshToken(sessionId: string): { token: string; secretHash: string } {
    const secret = randomBytes(32).toString('base64url');
    return { token: `${sessionId}.${secret}`, secretHash: hashSecret(secret) };
}

export function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1) return null;
    return { sessionId: token.slice(0, dot), secret: token.slice(dot + 1) };
}

async function requireContainer() {
    const container = await getContainer('MobileSessions');
    if (!container) throw new Error('MobileSessions container not initialized');
    return container;
}

export async function createSession(input: {
    userId: string;
    authType: 'oauth' | 'guest';
    provider?: string;
    familyId?: string;
}): Promise<{ session: MobileSessionDoc; refreshToken: string }> {
    const container = await requireContainer();
    const sessionId = randomUUID();
    const { token, secretHash } = buildRefreshToken(sessionId);
    const now = new Date();
    const doc: MobileSessionDoc = {
        id: sessionId,
        userId: input.userId,
        docType: 'session',
        authType: input.authType,
        provider: input.provider,
        familyId: input.familyId ?? randomUUID(),
        refreshTokenHash: secretHash,
        usedTokenHashes: [],
        absoluteExpiresAt: new Date(now.getTime() + REFRESH_ABSOLUTE_TTL_DAYS * 86400_000).toISOString(),
        inactivityExpiresAt: new Date(now.getTime() + REFRESH_INACTIVITY_TTL_DAYS * 86400_000).toISOString(),
        revokedAt: null,
        createdAt: now.toISOString(),
        lastUsedAt: now.toISOString(),
    };
    await container.items.create(doc);
    return { session: doc, refreshToken: token };
}

/** sessionIdからセッションを解決する（PKはdocから判明しないためidクエリ） */
export async function findSessionById(sessionId: string): Promise<MobileSessionDoc | null> {
    const container = await requireContainer();
    const { resources } = await container.items
        .query<MobileSessionDoc>({
            query: "SELECT * FROM c WHERE c.id = @id AND c.docType = 'session'",
            parameters: [{ name: '@id', value: sessionId }],
        })
        .fetchAll();
    return resources[0] ?? null;
}

/** token familyの全セッションを失効する（reuse検知時、詳細設計§5.2） */
export async function revokeFamily(userId: string, familyId: string): Promise<number> {
    const container = await requireContainer();
    const { resources } = await container.items
        .query<MobileSessionDoc>({
            query: "SELECT * FROM c WHERE c.userId = @userId AND c.familyId = @familyId AND c.docType = 'session' AND IS_NULL(c.revokedAt)",
            parameters: [
                { name: '@userId', value: userId },
                { name: '@familyId', value: familyId },
            ],
        })
        .fetchAll();
    const revokedAt = new Date().toISOString();
    for (const doc of resources) {
        await container.items.upsert({ ...doc, revokedAt });
    }
    return resources.length;
}

export async function revokeSession(sessionId: string): Promise<boolean> {
    const container = await requireContainer();
    const session = await findSessionById(sessionId);
    if (!session || session.revokedAt) return false;
    await container.items.upsert({ ...session, revokedAt: new Date().toISOString() });
    return true;
}

/**
 * Refresh Tokenローテーション（single-useを保証）
 * - 使用済みsecretの再提示 → familyを全失効して 'reused'
 * - 期限切れ（絶対/無操作）→ 'expired'
 */
export async function rotateRefreshToken(presentedToken: string): Promise<RefreshResult> {
    const parsed = parseRefreshToken(presentedToken);
    if (!parsed) return { ok: false, reason: 'invalid' };

    const session = await findSessionById(parsed.sessionId);
    if (!session) return { ok: false, reason: 'invalid' };
    if (session.revokedAt) return { ok: false, reason: 'revoked' };

    const presentedHash = hashSecret(parsed.secret);

    if (session.usedTokenHashes.some((h) => hashesEqual(h, presentedHash))) {
        await revokeFamily(session.userId, session.familyId);
        return { ok: false, reason: 'reused' };
    }
    if (!hashesEqual(session.refreshTokenHash, presentedHash)) {
        return { ok: false, reason: 'invalid' };
    }

    const now = new Date();
    if (now.toISOString() > session.absoluteExpiresAt || now.toISOString() > session.inactivityExpiresAt) {
        return { ok: false, reason: 'expired' };
    }

    const container = await requireContainer();
    const { token, secretHash } = buildRefreshToken(session.id);
    const updated: MobileSessionDoc = {
        ...session,
        refreshTokenHash: secretHash,
        // 直近の使用済みhashのみ保持（reuse検知には直前世代で十分、肥大化防止で最大5世代）
        usedTokenHashes: [...session.usedTokenHashes, session.refreshTokenHash].slice(-5),
        inactivityExpiresAt: new Date(now.getTime() + REFRESH_INACTIVITY_TTL_DAYS * 86400_000).toISOString(),
        lastUsedAt: now.toISOString(),
    };
    await container.items.upsert(updated);
    return { ok: true, session: updated, refreshToken: token };
}
