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
    userId?: string;
    docType?: string;
    [key: string]: unknown;
}

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
            query: (spec: { query: string; parameters: { name: string; value: unknown }[] }) => ({
                fetchAll: async () => {
                    const param = (n: string) => spec.parameters.find((p) => p.name === n)?.value;
                    let resources: Doc[] = [];
                    if (spec.query.includes("c.docType = 'auth_transaction'") && spec.query.includes('c.id = @id')) {
                        const d = docs.get(param('@id') as string);
                        resources = d?.docType === 'auth_transaction' ? [structuredClone(d)] : [];
                    } else if (spec.query.includes('c.bridgeCodeHash = @hash')) {
                        resources = [...docs.values()]
                            .filter((d) => d.docType === 'auth_transaction' && d.bridgeCodeHash === param('@hash'))
                            .map((d) => structuredClone(d));
                    } else if (spec.query.includes("c.docType = 'session'") && spec.query.includes('c.id = @id')) {
                        const d = docs.get(param('@id') as string);
                        resources = d?.docType === 'session' ? [structuredClone(d)] : [];
                    } else if (spec.query.includes('c.providerAccountId = @providerAccountId')) {
                        resources = [...docs.values()]
                            .filter(
                                (d) =>
                                    d.providerAccountId === param('@providerAccountId') &&
                                    d.provider === param('@provider')
                            )
                            .map((d) => structuredClone(d));
                    }
                    return { resources };
                },
            }),
        },
    };
}

const registry = new Map<string, ReturnType<typeof createMemoryContainer>>();

beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    process.env.MOBILE_JWT_PRIVATE_KEY = await exportPKCS8(privateKey);
    process.env.MOBILE_JWT_PUBLIC_KEY = await exportSPKI(publicKey);
    process.env.MOBILE_GITHUB_CLIENT_ID = 'gh-client';
    process.env.MOBILE_GITHUB_CLIENT_SECRET = 'gh-secret';
    process.env.MOBILE_OAUTH_REDIRECT_BASE = 'https://staging.example.com';
    process.env.MOBILE_OAUTH_APP_REDIRECT = 'shikakuno://oauth-result';
    const { resetKeyCacheForTesting } = await import('@/lib/mobile/jwt');
    resetKeyCacheForTesting();
});

beforeEach(async () => {
    vi.clearAllMocks();
    for (const name of ['MobileSessions', 'Users', 'Accounts']) {
        registry.set(name, createMemoryContainer());
    }
    const { getContainer } = await import('@/lib/cosmos');
    (getContainer as ReturnType<typeof vi.fn>).mockImplementation(async (name: string) => registry.get(name));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

/** GitHubのtoken/userinfoをスタブする */
function stubGithub(profile: { id: number; login?: string; email?: string }) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL) => {
            const url = String(input);
            if (url.includes('login/oauth/access_token')) {
                return new Response(JSON.stringify({ access_token: 'provider-token' }), {
                    headers: { 'content-type': 'application/json' },
                });
            }
            if (url.includes('api.github.com/user')) {
                return new Response(JSON.stringify(profile), {
                    headers: { 'content-type': 'application/json' },
                });
            }
            throw new Error(`unexpected fetch: ${url}`);
        })
    );
}

function makePkce() {
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

async function startAuthorize(challenge: string) {
    const { POST } = await import('@/app/api/mobile/v1/auth/authorize/route');
    const res = await POST(
        new NextRequest('http://localhost/api/mobile/v1/auth/authorize', {
            method: 'POST',
            body: JSON.stringify({
                provider: 'github',
                codeChallenge: challenge,
                codeChallengeMethod: 'S256',
                state: 'client-state-0123456789abcdef',
            }),
            headers: { 'content-type': 'application/json' },
        })
    );
    return { res, body: await res.json() };
}

async function hitCallback(serverState: string) {
    const { GET } = await import('@/app/api/mobile/v1/auth/callback/[provider]/route');
    const res = await GET(
        new NextRequest(
            `https://staging.example.com/api/mobile/v1/auth/callback/github?code=prov-code&state=${encodeURIComponent(serverState)}`
        ),
        { params: Promise.resolve({ provider: 'github' }) }
    );
    return res;
}

async function postExchange(bridgeCode: string, codeVerifier: string) {
    const { POST } = await import('@/app/api/mobile/v1/auth/exchange/route');
    return POST(
        new NextRequest('http://localhost/api/mobile/v1/auth/exchange', {
            method: 'POST',
            body: JSON.stringify({ bridgeCode, codeVerifier }),
            headers: { 'content-type': 'application/json' },
        })
    );
}

describe('OAuth bridgeフロー（詳細設計§5.1）', () => {
    it('authorize応答にprovider URLとserver stateが含まれる', async () => {
        const { challenge } = makePkce();
        const { res, body } = await startAuthorize(challenge);
        expect(res.status).toBe(200);
        expect(Mobile.authorizeResponseSchema.safeParse(body).success).toBe(true);
        const url = new URL(body.authorizationUrl);
        expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
        expect(url.searchParams.get('client_id')).toBe('gh-client');
        expect(url.searchParams.get('redirect_uri')).toBe(
            'https://staging.example.com/api/mobile/v1/auth/callback/github'
        );
        expect(url.searchParams.get('state')).toContain(body.transactionId);
    });

    it('authorize→callback→exchange→me の一連が成立しProvider tokenは応答に含まれない', async () => {
        const { verifier, challenge } = makePkce();
        stubGithub({ id: 12345, login: 'kei', email: 'kei@example.com' });

        const { body: auth } = await startAuthorize(challenge);
        const serverState = new URL(auth.authorizationUrl).searchParams.get('state')!;

        const cbRes = await hitCallback(serverState);
        expect(cbRes.status).toBe(302);
        const location = new URL(cbRes.headers.get('location')!);
        expect(location.protocol).toBe('shikakuno:');
        expect(location.searchParams.get('state')).toBe('client-state-0123456789abcdef');
        const bridgeCode = location.searchParams.get('bridgeCode')!;
        expect(bridgeCode).toBeTruthy();
        expect(location.searchParams.get('error')).toBeNull();

        const exRes = await postExchange(bridgeCode, verifier);
        expect(exRes.status).toBe(200);
        const exchange = await exRes.json();
        expect(Mobile.exchangeResponseSchema.safeParse(exchange).success).toBe(true);
        expect(JSON.stringify(exchange)).not.toContain('provider-token');

        // 新規User+Accountが作成されている
        expect(registry.get('Users')!.docs.size).toBe(1);
        expect(registry.get('Accounts')!.docs.size).toBe(1);

        // 発行されたATでmeが通る
        const { GET } = await import('@/app/api/mobile/v1/auth/me/route');
        const meRes = await GET(
            new NextRequest('http://localhost/api/mobile/v1/auth/me', {
                headers: { authorization: `Bearer ${exchange.tokens.accessToken}` },
            })
        );
        expect(meRes.status).toBe(200);
        expect((await meRes.json()).authType).toBe('oauth');
    });

    it('既存アカウントは再ログインで同一userIdに解決される（重複作成しない）', async () => {
        stubGithub({ id: 777, login: 'repeat' });
        const run = async () => {
            const { verifier, challenge } = makePkce();
            const { body: auth } = await startAuthorize(challenge);
            const serverState = new URL(auth.authorizationUrl).searchParams.get('state')!;
            const cb = await hitCallback(serverState);
            const bridgeCode = new URL(cb.headers.get('location')!).searchParams.get('bridgeCode')!;
            const ex = await postExchange(bridgeCode, verifier);
            return (await ex.json()).user.userId as string;
        };
        const first = await run();
        const second = await run();
        expect(second).toBe(first);
        expect(registry.get('Users')!.docs.size).toBe(1);
    });

    it('改ざんstateはbridge codeを発行せずerror=invalid_stateで戻す', async () => {
        const { challenge } = makePkce();
        stubGithub({ id: 1 });
        await startAuthorize(challenge);
        const res = await hitCallback('bogus.state');
        expect(res.status).toBe(302);
        expect(new URL(res.headers.get('location')!).searchParams.get('error')).toBe('invalid_state');
    });

    it('PKCE verifier不一致は401を返しトランザクションを失効させる', async () => {
        const { challenge, verifier } = makePkce();
        stubGithub({ id: 2 });
        const { body: auth } = await startAuthorize(challenge);
        const serverState = new URL(auth.authorizationUrl).searchParams.get('state')!;
        const cb = await hitCallback(serverState);
        const bridgeCode = new URL(cb.headers.get('location')!).searchParams.get('bridgeCode')!;

        const bad = await postExchange(bridgeCode, 'x'.repeat(48));
        expect(bad.status).toBe(401);
        expect((await bad.json()).code).toBe('PKCE_MISMATCH');

        // 正しいverifierでももう使えない（潰し済み）
        const retry = await postExchange(bridgeCode, verifier);
        expect(retry.status).toBe(401);
    });

    it('bridge codeは一回限りで再利用は401になる', async () => {
        const { challenge, verifier } = makePkce();
        stubGithub({ id: 3 });
        const { body: auth } = await startAuthorize(challenge);
        const serverState = new URL(auth.authorizationUrl).searchParams.get('state')!;
        const cb = await hitCallback(serverState);
        const bridgeCode = new URL(cb.headers.get('location')!).searchParams.get('bridgeCode')!;

        expect((await postExchange(bridgeCode, verifier)).status).toBe(200);
        const reuse = await postExchange(bridgeCode, verifier);
        expect(reuse.status).toBe(401);
        expect((await reuse.json()).code).toBe('INVALID_BRIDGE_CODE');
    });
});
