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
    docType?: string;
    _ts?: number;
    [key: string]: unknown;
}

/** create時のID重複409を再現するインメモリコンテナ */
function createMemoryContainer(name: string) {
    const docs = new Map<string, Doc>();
    let tsCounter = 1000;
    return {
        name,
        docs,
        failNextCreate: false,
        items: {
            create: async function (this: void, doc: Doc) {
                const self = containerRegistry.get(name)!;
                if (self.failNextCreate) {
                    self.failNextCreate = false;
                    throw new Error('Service Unavailable');
                }
                if (docs.has(doc.id)) {
                    const err = new Error('Conflict') as Error & { statusCode: number };
                    err.statusCode = 409;
                    throw err;
                }
                docs.set(doc.id, { ...structuredClone(doc), _ts: tsCounter++ });
                return { resource: doc };
            },
            upsert: async (doc: Doc) => {
                const prev = docs.get(doc.id);
                docs.set(doc.id, { ...structuredClone(doc), _ts: prev?._ts ?? tsCounter++ });
                return { resource: doc };
            },
            query: (spec: { query: string; parameters: { name: string; value: unknown }[] }) => ({
                fetchAll: async () => {
                    const param = (n: string) => spec.parameters.find((p) => p.name === n)?.value;
                    let resources: Doc[] = [];
                    if (spec.query.includes('c.id = @id')) {
                        const found = docs.get(param('@id') as string);
                        resources = found && found.docType === 'session' ? [structuredClone(found)] : [];
                    } else if (spec.query.includes('c._ts > @since')) {
                        resources = [...docs.values()]
                            .filter((d) => d.userId === param('@userId') && (d._ts ?? 0) > (param('@since') as number))
                            .sort((a, b) => (a._ts ?? 0) - (b._ts ?? 0))
                            .map((d) => structuredClone(d));
                    } else if (spec.query.includes('c.familyId = @familyId')) {
                        resources = [];
                    }
                    return { resources };
                },
            }),
        },
    };
}

const containerRegistry = new Map<string, ReturnType<typeof createMemoryContainer>>();

beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    process.env.MOBILE_JWT_PRIVATE_KEY = await exportPKCS8(privateKey);
    process.env.MOBILE_JWT_PUBLIC_KEY = await exportSPKI(publicKey);
    const { resetKeyCacheForTesting } = await import('@/lib/mobile/jwt');
    resetKeyCacheForTesting();
});

beforeEach(async () => {
    vi.clearAllMocks();
    containerRegistry.set('MobileSessions', createMemoryContainer('MobileSessions'));
    containerRegistry.set('MobileSyncEvents', createMemoryContainer('MobileSyncEvents'));
    const { getContainer } = await import('@/lib/cosmos');
    (getContainer as ReturnType<typeof vi.fn>).mockImplementation(async (name: string) =>
        containerRegistry.get(name)
    );
});

async function issueGuestToken(): Promise<{ accessToken: string; userId: string }> {
    const { POST } = await import('@/app/api/mobile/v1/auth/guest/route');
    const res = await POST(new NextRequest('http://localhost/api/mobile/v1/auth/guest', { method: 'POST' }));
    const body = await res.json();
    return { accessToken: body.tokens.accessToken, userId: `guest:${body.guestId}` };
}

function makeEvent(n: number, overrides: Partial<Mobile.SyncEvent> = {}): Mobile.SyncEvent {
    return {
        eventId: `0f6f1c1e-9a72-4f6e-9a3a-${String(n).padStart(12, '0')}`,
        type: 'answer_submitted',
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
        payload: { questionId: `q${n}`, answer: 'ア' },
        schemaVersion: 1,
        ...overrides,
    };
}

async function postBatch(accessToken: string, events: unknown) {
    const { POST } = await import('@/app/api/mobile/v1/sync/batch/route');
    return POST(
        new NextRequest('http://localhost/api/mobile/v1/sync/batch', {
            method: 'POST',
            body: JSON.stringify({ events }),
            headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        })
    );
}

describe('POST /api/mobile/v1/sync/batch', () => {
    it('全件appliedとなりJWT subの所有でイベントが保存される', async () => {
        const { accessToken, userId } = await issueGuestToken();
        const res = await postBatch(accessToken, [makeEvent(1), makeEvent(2)]);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Mobile.syncBatchResponseSchema.safeParse(body).success).toBe(true);
        expect(body.results.map((r: Mobile.SyncEventResult) => r.status)).toEqual(['applied', 'applied']);

        const stored = [...containerRegistry.get('MobileSyncEvents')!.docs.values()];
        expect(stored).toHaveLength(2);
        // payloadへ別ユーザーIDを入れても所有はJWT subになる
        expect(stored.every((d) => d.userId === userId)).toBe(true);
    });

    it('同一eventIdの再送はduplicateになりデータは重複しない（冪等）', async () => {
        const { accessToken } = await issueGuestToken();
        await postBatch(accessToken, [makeEvent(1)]);
        const res = await postBatch(accessToken, [makeEvent(1), makeEvent(2)]);
        const body = await res.json();
        expect(body.results[0].status).toBe('duplicate');
        expect(body.results[1].status).toBe('applied');
        expect(containerRegistry.get('MobileSyncEvents')!.docs.size).toBe(2);
    });

    it('1件の保存失敗はretryable_errorとなり他イベントへ波及しない（部分ACK）', async () => {
        const { accessToken } = await issueGuestToken();
        containerRegistry.get('MobileSyncEvents')!.failNextCreate = true;
        const res = await postBatch(accessToken, [makeEvent(1), makeEvent(2)]);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.results[0].status).toBe('retryable_error');
        expect(body.results[1].status).toBe('applied');
    });

    it('未来時刻のイベントはrejectedになる', async () => {
        const { accessToken } = await issueGuestToken();
        const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const res = await postBatch(accessToken, [makeEvent(1, { occurredAt: future })]);
        const body = await res.json();
        expect(body.results[0].status).toBe('rejected');
    });

    it('51件のバッチは400を返す', async () => {
        const { accessToken } = await issueGuestToken();
        const events = Array.from({ length: 51 }, (_, i) => makeEvent(i));
        const res = await postBatch(accessToken, events);
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe('INVALID_BATCH');
    });

    it('未認証は401を返す', async () => {
        const res = await postBatch('invalid-token', [makeEvent(1)]);
        expect(res.status).toBe(401);
    });
});

describe('GET /api/mobile/v1/sync/changes', () => {
    it('cursor以降の自ユーザーのイベントだけを返す', async () => {
        const { accessToken } = await issueGuestToken();
        const other = await issueGuestToken();
        await postBatch(accessToken, [makeEvent(1), makeEvent(2)]);
        await postBatch(other.accessToken, [makeEvent(3)]);

        const { GET } = await import('@/app/api/mobile/v1/sync/changes/route');
        const res = await GET(
            new NextRequest('http://localhost/api/mobile/v1/sync/changes', {
                headers: { authorization: `Bearer ${accessToken}` },
            })
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Mobile.syncChangesResponseSchema.safeParse(body).success).toBe(true);
        expect(body.changes).toHaveLength(2);
        expect(body.nextCursor).not.toBeNull();

        // cursor指定で差分なし
        const res2 = await GET(
            new NextRequest(`http://localhost/api/mobile/v1/sync/changes?cursor=${body.nextCursor}`, {
                headers: { authorization: `Bearer ${accessToken}` },
            })
        );
        expect((await res2.json()).changes).toHaveLength(0);
    });
});
