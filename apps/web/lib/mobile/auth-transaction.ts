/**
 * 認証トランザクション（詳細設計§5.1）
 * - MobileSessionsコンテナへ短命docとして保存（docType: auth_transaction）
 * - server state（=トランザクションID相当の乱数）でcallbackを照合
 * - bridge codeは一回限り・ハッシュ保存・5分で失効
 * - PKCE: S256(codeVerifier) === codeChallenge をexchange時に検証
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { getContainer } from '@/lib/cosmos';
import { Mobile } from '@ipa-lab/shared';

const TRANSACTION_TTL_MS = 10 * 60 * 1000;
const BRIDGE_CODE_TTL_MS = 5 * 60 * 1000;

export interface AuthTransactionDoc {
    id: string;
    /** PK。`txn:{id}` 固定（ユーザー未確定のため） */
    userId: string;
    docType: 'auth_transaction';
    provider: Mobile.OAuthProvider;
    codeChallenge: string;
    clientState: string;
    serverStateHash: string;
    status: 'started' | 'awaiting_exchange' | 'consumed';
    resolvedUserId: string | null;
    bridgeCodeHash: string | null;
    bridgeCodeExpiresAt: string | null;
    expiresAt: string;
    createdAt: string;
}

function sha256hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function hashesEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function requireContainer() {
    const container = await getContainer('MobileSessions');
    if (!container) throw new Error('MobileSessions container not initialized');
    return container;
}

export async function createAuthTransaction(input: {
    provider: Mobile.OAuthProvider;
    codeChallenge: string;
    clientState: string;
}): Promise<{ transactionId: string; serverState: string; expiresAt: string }> {
    const container = await requireContainer();
    const transactionId = randomUUID();
    const serverState = `${transactionId}.${randomBytes(16).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + TRANSACTION_TTL_MS).toISOString();
    const doc: AuthTransactionDoc = {
        id: transactionId,
        userId: `txn:${transactionId}`,
        docType: 'auth_transaction',
        provider: input.provider,
        codeChallenge: input.codeChallenge,
        clientState: input.clientState,
        serverStateHash: sha256hex(serverState),
        status: 'started',
        resolvedUserId: null,
        bridgeCodeHash: null,
        bridgeCodeExpiresAt: null,
        expiresAt,
        createdAt: new Date().toISOString(),
    };
    await container.items.create(doc);
    return { transactionId, serverState, expiresAt };
}

async function findTransactionById(transactionId: string): Promise<AuthTransactionDoc | null> {
    const container = await requireContainer();
    const { resources } = await container.items
        .query<AuthTransactionDoc>({
            query: "SELECT * FROM c WHERE c.id = @id AND c.docType = 'auth_transaction'",
            parameters: [{ name: '@id', value: transactionId }],
        })
        .fetchAll();
    return resources[0] ?? null;
}

/** callback: server stateを照合しbridge codeを発行する */
export async function resolveCallback(
    serverState: string,
    resolvedUserId: string
): Promise<{ bridgeCode: string; clientState: string } | null> {
    const transactionId = serverState.split('.')[0];
    if (!transactionId) return null;

    const txn = await findTransactionById(transactionId);
    if (!txn || txn.status !== 'started') return null;
    if (new Date().toISOString() > txn.expiresAt) return null;
    if (!hashesEqual(txn.serverStateHash, sha256hex(serverState))) return null;

    const bridgeCode = randomBytes(32).toString('base64url');
    const container = await requireContainer();
    const updated: AuthTransactionDoc = {
        ...txn,
        status: 'awaiting_exchange',
        resolvedUserId,
        bridgeCodeHash: sha256hex(bridgeCode),
        bridgeCodeExpiresAt: new Date(Date.now() + BRIDGE_CODE_TTL_MS).toISOString(),
    };
    await container.items.upsert(updated);
    return { bridgeCode, clientState: txn.clientState };
}

export type ExchangeOutcome =
    | { ok: true; userId: string; provider: Mobile.OAuthProvider }
    | { ok: false; reason: 'invalid' | 'expired' | 'pkce_mismatch' };

/** exchange: bridge code（一回限り）とPKCE verifierを検証する */
export async function consumeBridgeCode(bridgeCode: string, codeVerifier: string): Promise<ExchangeOutcome> {
    const container = await requireContainer();
    const codeHash = sha256hex(bridgeCode);
    const { resources } = await container.items
        .query<AuthTransactionDoc>({
            query: "SELECT * FROM c WHERE c.bridgeCodeHash = @hash AND c.docType = 'auth_transaction'",
            parameters: [{ name: '@hash', value: codeHash }],
        })
        .fetchAll();
    const txn = resources[0];
    if (!txn || txn.status !== 'awaiting_exchange' || !txn.resolvedUserId) {
        return { ok: false, reason: 'invalid' };
    }
    if (!txn.bridgeCodeExpiresAt || new Date().toISOString() > txn.bridgeCodeExpiresAt) {
        return { ok: false, reason: 'expired' };
    }

    // PKCE S256検証
    const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
    if (challenge !== txn.codeChallenge) {
        // verifier不一致は攻撃の可能性があるためトランザクションを潰す
        await container.items.upsert({ ...txn, status: 'consumed' });
        return { ok: false, reason: 'pkce_mismatch' };
    }

    await container.items.upsert({ ...txn, status: 'consumed' });
    return { ok: true, userId: txn.resolvedUserId, provider: txn.provider };
}
