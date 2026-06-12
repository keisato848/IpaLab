import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';
import { Mobile } from '@ipa-lab/shared';

vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn(),
}));

interface Doc {
    id: string;
    userId: string;
    docType: string;
    familyId?: string;
    revokedAt?: string | null;
    [key: string]: unknown;
}

/** MobileSessionsのインメモリ実装 */
function createMemoryContainer() {
    const docs = new Map<string, Doc>();
    return {
        docs,
        items: {
            create: async (doc: Doc) => {
                docs.set(doc.id, structuredClone(doc));
                return { resource: doc };
            },
            upsert: async (doc: Doc) => {
                docs.set(doc.id, structuredClone(doc));
                return { resource: doc };
            },
            query: (spec: { query: string; parameters: { name: string; value: string }[] }) => ({
                fetchAll: async () => {
                    const param = (n: string) => spec.parameters.find((p) => p.name === n)?.value;
                    let resources: Doc[] = [];
                    if (spec.query.includes('c.id = @id')) {
                        const found = docs.get(param('@id') ?? '');
                        resources = found && found.docType === 'session' ? [structuredClone(found)] : [];
                    } else if (spec.query.includes('c.familyId = @familyId')) {
                        resources = [...docs.values()]
                            .filter(
                                (d) =>
                                    d.docType === 'session' &&
                                    d.userId === param('@userId') &&
                                    d.familyId === param('@familyId') &&
                                    d.revokedAt == null
                            )
                            .map((d) => structuredClone(d));
                    }
                    return { resources };
                },
            }),
        },
    };
}

let container: ReturnType<typeof createMemoryContainer>;

beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    process.env.MOBILE_JWT_PRIVATE_KEY = await exportPKCS8(privateKey);
    process.env.MOBILE_JWT_PUBLIC_KEY = await exportSPKI(publicKey);
    const { resetKeyCacheForTesting } = await import('@/lib/mobile/jwt');
    resetKeyCacheForTesting();
});

beforeEach(async () => {
    vi.clearAllMocks();
    container = createMemoryContainer();
    const { getContainer } = await import('@/lib/cosmos');
    (getContainer as ReturnType<typeof vi.fn>).mockImplementation(async (name: string) =>
        name === 'MobileSessions' ? container : undefined
    );
});

async function issueGuest() {
    const { POST } = await import('@/app/api/mobile/v1/auth/guest/route');
    const res = await POST(new NextRequest('http://localhost/api/mobile/v1/auth/guest', { method: 'POST' }));
    return { res, body: await res.json() };
}

describe('POST /api/mobile/v1/auth/guest', () => {
    it('credentialとトークンペアをDTO準拠で発行する', async () => {
        const { res, body } = await issueGuest();
        expect(res.status).toBe(201);
        expect(Mobile.guestCredentialResponseSchema.safeParse(body).success).toBe(true);
        // credentialとsessionの2ドキュメントが保存される
        expect([...container.docs.values()].map((d) => d.docType).sort()).toEqual([
            'guest_credential',
            'session',
        ]);
        // 平文secretは保存しない
        const cred = [...container.docs.values()].find((d) => d.docType === 'guest_credential');
        expect(JSON.stringify(cred)).not.toContain(body.guestSecret);
    });
});

describe('GET /api/mobile/v1/auth/me', () => {
    it('発行したATでセッション情報を返す', async () => {
        const { body } = await issueGuest();
        const { GET } = await import('@/app/api/mobile/v1/auth/me/route');
        const res = await GET(
            new NextRequest('http://localhost/api/mobile/v1/auth/me', {
                headers: { authorization: `Bearer ${body.tokens.accessToken}` },
            })
        );
        expect(res.status).toBe(200);
        const me = await res.json();
        expect(Mobile.sessionInfoSchema.safeParse(me).success).toBe(true);
        expect(me.userId).toBe(`guest:${body.guestId}`);
        expect(me.authType).toBe('guest');
    });

    it('Bearerなしは401を返す', async () => {
        const { GET } = await import('@/app/api/mobile/v1/auth/me/route');
        const res = await GET(new NextRequest('http://localhost/api/mobile/v1/auth/me'));
        expect(res.status).toBe(401);
        expect((await res.json()).code).toBe('UNAUTHORIZED');
    });

    it('改ざんトークンは401を返す', async () => {
        const { body } = await issueGuest();
        const { GET } = await import('@/app/api/mobile/v1/auth/me/route');
        const tampered = body.tokens.accessToken.slice(0, -4) + 'AAAA';
        const res = await GET(
            new NextRequest('http://localhost/api/mobile/v1/auth/me', {
                headers: { authorization: `Bearer ${tampered}` },
            })
        );
        expect(res.status).toBe(401);
    });
});

describe('POST /api/mobile/v1/auth/refresh', () => {
    async function refresh(refreshToken: unknown) {
        const { POST } = await import('@/app/api/mobile/v1/auth/refresh/route');
        return POST(
            new NextRequest('http://localhost/api/mobile/v1/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({ refreshToken }),
                headers: { 'content-type': 'application/json' },
            })
        );
    }

    it('ローテーションして新しいトークンペアを返す', async () => {
        const { body } = await issueGuest();
        const res = await refresh(body.tokens.refreshToken);
        expect(res.status).toBe(200);
        const pair = await res.json();
        expect(Mobile.tokenPairSchema.safeParse(pair).success).toBe(true);
        expect(pair.refreshToken).not.toBe(body.tokens.refreshToken);
    });

    it('使用済みRefresh Tokenの再利用でfamilyを全失効し401を返す', async () => {
        const { body } = await issueGuest();
        const first = await refresh(body.tokens.refreshToken);
        const rotated = await first.json();

        // 旧トークンを再提示 → reuse検知
        const reuse = await refresh(body.tokens.refreshToken);
        expect(reuse.status).toBe(401);
        expect((await reuse.json()).code).toBe('TOKEN_REUSE_DETECTED');

        // family失効済みのため、最新トークンも使用不可
        const after = await refresh(rotated.refreshToken);
        expect(after.status).toBe(401);
    });

    it('不正な形式・未知のトークンは401を返す', async () => {
        await issueGuest();
        const res = await refresh('not-a-valid-token');
        expect(res.status).toBe(401);
        expect((await res.json()).code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('refreshToken欠落は400を返す', async () => {
        const res = await refresh(undefined);
        expect(res.status).toBe(400);
    });
});

describe('POST /api/mobile/v1/auth/revoke', () => {
    it('セッションを失効しmeが401になる', async () => {
        const { body } = await issueGuest();
        const auth = { authorization: `Bearer ${body.tokens.accessToken}` };

        const { POST } = await import('@/app/api/mobile/v1/auth/revoke/route');
        const revokeRes = await POST(
            new NextRequest('http://localhost/api/mobile/v1/auth/revoke', { method: 'POST', headers: auth })
        );
        expect(revokeRes.status).toBe(204);

        const { GET } = await import('@/app/api/mobile/v1/auth/me/route');
        const meRes = await GET(new NextRequest('http://localhost/api/mobile/v1/auth/me', { headers: auth }));
        expect(meRes.status).toBe(401);
    });
});
