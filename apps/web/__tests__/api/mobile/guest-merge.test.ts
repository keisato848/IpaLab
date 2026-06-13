import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';
import { Mobile } from '@ipa-lab/shared';

vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn(),
}));

interface Doc {
    id: string;
    userId: string;
    docType?: string;
    _ts?: number;
    [key: string]: unknown;
}

function createMemoryContainer() {
    // PK込みで保持（イベント移管のdelete/createを正しく再現するため）
    const docs = new Map<string, Doc>();
    const key = (id: string, pk: string) => `${pk}|${id}`;
    let tsCounter = 1000;
    return {
        docs,
        items: {
            create: async (doc: Doc) => {
                const k = key(doc.id, doc.userId);
                if (docs.has(k)) {
                    const err = new Error('Conflict') as Error & { statusCode: number };
                    err.statusCode = 409;
                    throw err;
                }
                docs.set(k, { ...structuredClone(doc), _ts: tsCounter++ });
                return { resource: doc };
            },
            upsert: async (doc: Doc) => {
                docs.set(key(doc.id, doc.userId), { ...structuredClone(doc), _ts: tsCounter++ });
                return { resource: doc };
            },
            query: (spec: { query: string; parameters: { name: string; value: unknown }[] }) => ({
                fetchAll: async () => {
                    const param = (n: string) => spec.parameters.find((p) => p.name === n)?.value;
                    const all = [...docs.values()];
                    let resources: Doc[] = [];
                    if (spec.query.includes("c.docType = 'guest_credential'")) {
                        resources = all.filter((d) => d.docType === 'guest_credential' && d.id === param('@id'));
                    } else if (spec.query.includes("c.docType = 'guest_merge'")) {
                        resources = all.filter((d) => d.docType === 'guest_merge' && d.guestId === param('@guestId'));
                    } else if (spec.query.includes("c.docType = 'session'") && spec.query.includes('c.id = @id')) {
                        resources = all.filter((d) => d.docType === 'session' && d.id === param('@id'));
                    } else if (spec.query.includes("c.docType = 'session'") && spec.query.includes('IS_NULL(c.revokedAt)')) {
                        resources = all.filter(
                            (d) => d.docType === 'session' && d.userId === param('@userId') && d.revokedAt == null
                        );
                    } else if (spec.query.includes('c._ts > @since')) {
                        resources = all
                            .filter((d) => d.userId === param('@userId') && (d._ts ?? 0) > (param('@since') as number))
                            .sort((a, b) => (a._ts ?? 0) - (b._ts ?? 0));
                    } else if (spec.query.trim() === 'SELECT * FROM c WHERE c.userId = @userId') {
                        resources = all.filter((d) => d.userId === param('@userId'));
                    }
                    return { resources: resources.map((d) => structuredClone(d)) };
                },
            }),
        },
        item: (id: string, pk: string) => ({
            delete: async () => {
                docs.delete(key(id, pk));
            },
        }),
    };
}

const registry = new Map<string, ReturnType<typeof createMemoryContainer>>();

beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    process.env.MOBILE_JWT_PRIVATE_KEY = await exportPKCS8(privateKey);
    process.env.MOBILE_JWT_PUBLIC_KEY = await exportSPKI(publicKey);
    const { resetKeyCacheForTesting } = await import('@/lib/mobile/jwt');
    resetKeyCacheForTesting();
});

beforeEach(async () => {
    vi.clearAllMocks();
    for (const name of ['MobileSessions', 'MobileSyncEvents', 'MobileGuestMerges', 'Users', 'Accounts']) {
        registry.set(name, createMemoryContainer());
    }
    const { getContainer } = await import('@/lib/cosmos');
    (getContainer as ReturnType<typeof vi.fn>).mockImplementation(async (name: string) => registry.get(name));
});

afterEach(() => vi.unstubAllGlobals());

async function issueGuest() {
    const { POST } = await import('@/app/api/mobile/v1/auth/guest/route');
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }));
    const body = await res.json();
    return body as { guestId: string; guestSecret: string; tokens: { accessToken: string } };
}

/** OAuthセッションを直接発行（bridgeを通さず簡略化） */
async function issueOAuthUser(userId: string) {
    const { createSession } = await import('@/lib/mobile/session-store');
    const { signAccessToken } = await import('@/lib/mobile/jwt');
    const { session } = await createSession({ userId, authType: 'oauth', provider: 'github' });
    const access = await signAccessToken({ sub: userId, sid: session.id, role: 'user', auth_type: 'oauth' });
    return access.token;
}

async function postGuestEvents(accessToken: string, count: number, offset = 0) {
    const { POST } = await import('@/app/api/mobile/v1/sync/batch/route');
    const events = Array.from({ length: count }, (_, i) => ({
        eventId: `0f6f1c1e-9a72-4f6e-9a3a-${String(i + offset).padStart(12, '0')}`,
        type: 'answer_submitted',
        occurredAt: new Date(Date.now() - 1000).toISOString(),
        payload: { q: i + offset },
        schemaVersion: 1,
    }));
    await POST(
        new NextRequest('http://localhost/x', {
            method: 'POST',
            body: JSON.stringify({ events }),
            headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        })
    );
}

async function postMerge(accessToken: string, body: unknown) {
    const { POST } = await import('@/app/api/mobile/v1/guest/merge/route');
    return POST(
        new NextRequest('http://localhost/api/mobile/v1/guest/merge', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        })
    );
}

const MERGE_ID = '11111111-2222-4333-8444-555555555555';

describe('POST /api/mobile/v1/guest/merge', () => {
    it('ゲストのイベントを統合先へ移管しゲストセッションを失効する', async () => {
        const guest = await issueGuest();
        await postGuestEvents(guest.tokens.accessToken, 3);
        const oauthToken = await issueOAuthUser('user-1');

        const res = await postMerge(oauthToken, {
            mergeId: MERGE_ID,
            guestId: guest.guestId,
            guestSecret: guest.guestSecret,
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Mobile.guestMergeResponseSchema.safeParse(body).success).toBe(true);
        expect(body.status).toBe('completed');
        expect(body.mergedEventCount).toBe(3);

        // イベントの所有者が統合先に変わり、ゲスト側は空
        const events = [...registry.get('MobileSyncEvents')!.docs.values()];
        expect(events).toHaveLength(3);
        expect(events.every((d) => d.userId === 'user-1')).toBe(true);

        // ゲストのトークンは使用不可（セッション失効）
        const { GET } = await import('@/app/api/mobile/v1/auth/me/route');
        const meRes = await GET(
            new NextRequest('http://localhost/x', {
                headers: { authorization: `Bearer ${guest.tokens.accessToken}` },
            })
        );
        expect(meRes.status).toBe(401);
    });

    it('同一mergeIdの再実行はalready_mergedで件数を再現する（冪等）', async () => {
        const guest = await issueGuest();
        await postGuestEvents(guest.tokens.accessToken, 2);
        const oauthToken = await issueOAuthUser('user-1');
        const req = { mergeId: MERGE_ID, guestId: guest.guestId, guestSecret: guest.guestSecret };

        await postMerge(oauthToken, req);
        const res = await postMerge(oauthToken, req);
        const body = await res.json();
        expect(body.status).toBe('already_merged');
        expect(body.mergedEventCount).toBe(2);
        expect([...registry.get('MobileSyncEvents')!.docs.values()]).toHaveLength(2);
    });

    it('統合済みguestを別アカウントへ統合しようとすると409 rejectedになる（横取り拒否）', async () => {
        const guest = await issueGuest();
        const tokenA = await issueOAuthUser('user-a');
        const tokenB = await issueOAuthUser('user-b');
        const req = { guestId: guest.guestId, guestSecret: guest.guestSecret };

        await postMerge(tokenA, { ...req, mergeId: MERGE_ID });
        const res = await postMerge(tokenB, { ...req, mergeId: '99999999-8888-4777-8666-555555555555' });
        expect(res.status).toBe(409);
        expect((await res.json()).status).toBe('rejected');
    });

    it('guestSecret不一致は401 rejectedになる', async () => {
        const guest = await issueGuest();
        const oauthToken = await issueOAuthUser('user-1');
        const res = await postMerge(oauthToken, {
            mergeId: MERGE_ID,
            guestId: guest.guestId,
            guestSecret: randomBytes(32).toString('base64url'),
        });
        expect(res.status).toBe(401);
        expect((await res.json()).status).toBe('rejected');
    });

    it('ゲストセッションからの統合要求は403になる', async () => {
        const guest = await issueGuest();
        const res = await postMerge(guest.tokens.accessToken, {
            mergeId: MERGE_ID,
            guestId: guest.guestId,
            guestSecret: guest.guestSecret,
        });
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe('OAUTH_REQUIRED');
    });

    it('統合後の差分pullで統合先ユーザーがゲスト履歴を取得できる', async () => {
        const guest = await issueGuest();
        await postGuestEvents(guest.tokens.accessToken, 2);
        const oauthToken = await issueOAuthUser('user-1');
        await postMerge(oauthToken, {
            mergeId: MERGE_ID,
            guestId: guest.guestId,
            guestSecret: guest.guestSecret,
        });

        const { GET } = await import('@/app/api/mobile/v1/sync/changes/route');
        const res = await GET(
            new NextRequest('http://localhost/api/mobile/v1/sync/changes', {
                headers: { authorization: `Bearer ${oauthToken}` },
            })
        );
        const body = await res.json();
        expect(body.changes).toHaveLength(2);
    });
});
