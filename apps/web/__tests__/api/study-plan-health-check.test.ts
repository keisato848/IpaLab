/**
 * /api/study-plan/health-check のユニットテスト (#220 / レビュー対応)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));
vi.mock('@/auth', () => ({ authOptions: {} }));

const VALID_PROFILE = {
    userId: 'u1',
    generatedAt: '2026-04-23T00:00:00.000Z',
    paceByWeekday: [0, 0, 0, 0, 0, 0, 0],
    recentAchievementRate: 0.5,
    consecutiveOnFireDays: 0,
    accuracyByCategory: {},
    continuityRate: 0,
    consecutiveStudyDays: 0,
    paceRatio: 1,
};

function buildRequest(body: unknown): Request {
    return new Request('http://localhost/api/study-plan/health-check', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('/api/study-plan/health-check POST', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('未認証は 401', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue(null);
        const { POST } = await import('@/app/api/study-plan/health-check/route');
        const res = await POST(buildRequest({ profile: VALID_PROFILE }));
        expect(res.status).toBe(401);
    });

    it('profile 欠落は 400 (INVALID_INPUT)', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'u1' } });
        const { POST } = await import('@/app/api/study-plan/health-check/route');
        const res = await POST(buildRequest({}));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('INVALID_INPUT');
    });

    it('NaN/不正数値は 400 (INVALID_INPUT)', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'u1' } });
        const { POST } = await import('@/app/api/study-plan/health-check/route');
        const res = await POST(
            buildRequest({
                profile: { ...VALID_PROFILE, recentAchievementRate: -1 },
            }),
        );
        expect(res.status).toBe(400);
    });

    it('正常系: PlanHealthResult を返す (slight_delay 50%)', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'u1' } });
        const { POST } = await import('@/app/api/study-plan/health-check/route');
        const res = await POST(buildRequest({ profile: VALID_PROFILE }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('slight_delay');
        expect(body.shouldNotify).toBe(true);
    });

    it('JSON パース失敗は 400 (INVALID_JSON)', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'u1' } });
        const req = new Request('http://localhost/api/study-plan/health-check', {
            method: 'POST',
            body: 'not-json{{{',
            headers: { 'Content-Type': 'application/json' },
        });
        const { POST } = await import('@/app/api/study-plan/health-check/route');
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('INVALID_JSON');
    });
});
