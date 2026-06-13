/**
 * Mobile study-plans API テスト（WP-4.2）
 *
 * - GET /api/mobile/v1/study-plans     → 一覧返却
 * - GET /api/mobile/v1/study-plans/:id → 1件取得・未存在 404
 * - PUT /api/mobile/v1/study-plans/:id → version一致→保存、不一致→409
 * - 未認証は 401
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as listPlans } from '@/app/api/mobile/v1/study-plans/route';
import { GET as getPlan, PUT as putPlan } from '@/app/api/mobile/v1/study-plans/[id]/route';
import type { MobileStudyPlan } from '@ipa-lab/shared';

// ---- インメモリ Cosmos モック ----
type DocRecord = Record<string, unknown>;
const planDocs = new Map<string, DocRecord>();

vi.mock('@/lib/cosmos', () => ({
    ensureContainer: vi.fn((_name: string) => ({
        items: {
            query: (_spec: unknown) => ({
                fetchAll: async () => ({
                    resources: [...planDocs.values()].filter((d) => d['userId'] === currentUser),
                }),
            }),
            upsert: async (doc: DocRecord) => {
                planDocs.set(doc['id'] as string, { ...doc });
                return { resource: { ...doc } };
            },
        },
        item: (id: string, partitionKey: string) => ({
            read: async () => {
                const doc = planDocs.get(id);
                if (!doc || doc['userId'] !== partitionKey) {
                    const err: NodeJS.ErrnoException & { code?: number } = new Error('Not found') as NodeJS.ErrnoException & { code?: number };
                    err.code = 404;
                    throw err;
                }
                return { resource: { ...doc } };
            },
        }),
    })),
}));

// currentUser はテストごとに切り替える
let currentUser = 'user-abc';

vi.mock('@/lib/mobile/auth-guard', () => ({
    requireMobileSession: vi.fn(async () => ({
        sub: currentUser,
        sid: 'session-1',
        jti: 'jti-1',
        iss: 'test',
        aud: 'mobile',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        role: 'user',
        auth_type: 'oauth',
    })),
}));

// ---- ヘルパー ----

const BASE_PLAN: MobileStudyPlan = {
    id: 'plan-001',
    version: 0,
    title: 'AP 2026秋 対策プラン',
    targetExam: 'AP',
    examDate: '2026-10-18',
    monthlyGoal: '500問',
    weeklySchedule: [],
    generatedAt: new Date().toISOString(),
};

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
    const init: RequestInit = { method };
    if (body !== undefined) {
        init.body = JSON.stringify(body);
        init.headers = { 'content-type': 'application/json' };
    }
    return new NextRequest(url, init);
}

beforeEach(() => {
    vi.clearAllMocks();
    planDocs.clear();
    currentUser = 'user-abc';
});

// ---- テスト ----

describe('GET /api/mobile/v1/study-plans', () => {
    it('一覧を返す', async () => {
        planDocs.set(BASE_PLAN.id, { ...BASE_PLAN, userId: 'user-abc', docType: 'studyPlan' });
        const res = await listPlans(makeRequest('GET', 'http://localhost/api/mobile/v1/study-plans'));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.plans).toHaveLength(1);
        expect(json.plans[0].id).toBe('plan-001');
        expect(json.plans[0].version).toBe(0);
    });

    it('他ユーザーの計画は含まない', async () => {
        planDocs.set('plan-other', { ...BASE_PLAN, id: 'plan-other', userId: 'user-xyz', docType: 'studyPlan' });
        const res = await listPlans(makeRequest('GET', 'http://localhost/api/mobile/v1/study-plans'));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.plans).toHaveLength(0);
    });

    it('未認証は 401', async () => {
        const { requireMobileSession } = await import('@/lib/mobile/auth-guard');
        vi.mocked(requireMobileSession).mockResolvedValueOnce(null);
        const res = await listPlans(makeRequest('GET', 'http://localhost/api/mobile/v1/study-plans'));
        expect(res.status).toBe(401);
    });
});

describe('GET /api/mobile/v1/study-plans/:id', () => {
    it('計画を1件返す', async () => {
        planDocs.set(BASE_PLAN.id, { ...BASE_PLAN, userId: 'user-abc', docType: 'studyPlan' });
        const res = await getPlan(makeRequest('GET', 'http://localhost/api/mobile/v1/study-plans/plan-001'), {
            params: Promise.resolve({ id: 'plan-001' }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe('plan-001');
        expect(json.version).toBe(0);
    });

    it('存在しない id は 404', async () => {
        const res = await getPlan(makeRequest('GET', 'http://localhost/api/mobile/v1/study-plans/no-such'), {
            params: Promise.resolve({ id: 'no-such' }),
        });
        expect(res.status).toBe(404);
    });
});

describe('PUT /api/mobile/v1/study-plans/:id', () => {
    it('version 一致→保存・version が +1 される', async () => {
        planDocs.set(BASE_PLAN.id, { ...BASE_PLAN, userId: 'user-abc', docType: 'studyPlan', version: 0 });

        const update = { ...BASE_PLAN, title: '更新後タイトル', version: 0 };
        const res = await putPlan(
            makeRequest('PUT', 'http://localhost/api/mobile/v1/study-plans/plan-001', update),
            { params: Promise.resolve({ id: 'plan-001' }) },
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.version).toBe(1);
        expect(json.title).toBe('更新後タイトル');
    });

    it('version 不一致→ 409 VERSION_CONFLICT + current を返す', async () => {
        planDocs.set(BASE_PLAN.id, { ...BASE_PLAN, userId: 'user-abc', docType: 'studyPlan', version: 5 });

        const stale = { ...BASE_PLAN, title: '古いバージョン', version: 3 };
        const res = await putPlan(
            makeRequest('PUT', 'http://localhost/api/mobile/v1/study-plans/plan-001', stale),
            { params: Promise.resolve({ id: 'plan-001' }) },
        );
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.code).toBe('VERSION_CONFLICT');
        expect(json.current.version).toBe(5);
        expect(json.retryable).toBe(false);
    });

    it('新規（未存在）プランは version 0 で作成可', async () => {
        const newPlan = { ...BASE_PLAN, id: 'plan-new', version: 0 };
        const res = await putPlan(
            makeRequest('PUT', 'http://localhost/api/mobile/v1/study-plans/plan-new', newPlan),
            { params: Promise.resolve({ id: 'plan-new' }) },
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.version).toBe(1);
    });

    it('body と path の id 不一致は 400', async () => {
        const res = await putPlan(
            makeRequest('PUT', 'http://localhost/api/mobile/v1/study-plans/plan-001', { ...BASE_PLAN, id: 'different-id' }),
            { params: Promise.resolve({ id: 'plan-001' }) },
        );
        expect(res.status).toBe(400);
    });

    it('不正 body は 400', async () => {
        const res = await putPlan(
            makeRequest('PUT', 'http://localhost/api/mobile/v1/study-plans/plan-001', { invalid: true }),
            { params: Promise.resolve({ id: 'plan-001' }) },
        );
        expect(res.status).toBe(400);
    });

    it('未認証は 401', async () => {
        const { requireMobileSession } = await import('@/lib/mobile/auth-guard');
        vi.mocked(requireMobileSession).mockResolvedValueOnce(null);
        const res = await putPlan(
            makeRequest('PUT', 'http://localhost/api/mobile/v1/study-plans/plan-001', BASE_PLAN),
            { params: Promise.resolve({ id: 'plan-001' }) },
        );
        expect(res.status).toBe(401);
    });
});
