/**
 * /api/profile/performance のユニットテスト (#218 / #224 レビュー対応)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn(),
}));
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));
vi.mock('@/auth', () => ({ authOptions: {} }));

vi.mock('@/lib/repositories/learningRecordRepository', () => ({
    learningRecordRepository: {
        findByUserIdInDateRange: vi.fn(),
    },
}));
vi.mock('@/lib/repositories/dailyProgressRepository', () => ({
    dailyProgressRepository: {
        findByUserAndDateRange: vi.fn(),
    },
}));
vi.mock('@/lib/repositories/studyPlanRepository', () => ({
    studyPlanRepository: {
        listByUser: vi.fn(),
    },
}));

describe('/api/profile/performance GET', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('未認証は 401', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue(null);
        const { GET } = await import('@/app/api/profile/performance/route');
        const res = await GET(new NextRequest('http://localhost/api/profile/performance'));
        expect(res.status).toBe(401);
    });

    it('正常系: profile を含むレスポンスを返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'u1' } });
        const lr = await import('@/lib/repositories/learningRecordRepository');
        const dp = await import('@/lib/repositories/dailyProgressRepository');
        const sp = await import('@/lib/repositories/studyPlanRepository');
        (lr.learningRecordRepository.findByUserIdInDateRange as any).mockResolvedValue([]);
        (dp.dailyProgressRepository.findByUserAndDateRange as any).mockResolvedValue([]);
        (sp.studyPlanRepository.listByUser as any).mockResolvedValue([]);

        const { GET } = await import('@/app/api/profile/performance/route');
        const res = await GET(new NextRequest('http://localhost/api/profile/performance'));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toHaveProperty('profile');
        expect(json.profile.userId).toBe('u1');
        expect(Array.isArray(json.profile.paceByWeekday)).toBe(true);
    });

    it('studyPlanRepository が失敗してもエラーログ後に処理継続 (profile を返す)', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'u2' } });
        const lr = await import('@/lib/repositories/learningRecordRepository');
        const dp = await import('@/lib/repositories/dailyProgressRepository');
        const sp = await import('@/lib/repositories/studyPlanRepository');
        (lr.learningRecordRepository.findByUserIdInDateRange as any).mockResolvedValue([]);
        (dp.dailyProgressRepository.findByUserAndDateRange as any).mockResolvedValue([]);
        (sp.studyPlanRepository.listByUser as any).mockRejectedValue(new Error('db down'));

        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { GET } = await import('@/app/api/profile/performance/route');
        const res = await GET(new NextRequest('http://localhost/api/profile/performance'));
        expect(res.status).toBe(200);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it('LearningRecord 取得は範囲指定で呼び出される', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'u3' } });
        const lr = await import('@/lib/repositories/learningRecordRepository');
        const dp = await import('@/lib/repositories/dailyProgressRepository');
        const sp = await import('@/lib/repositories/studyPlanRepository');
        (lr.learningRecordRepository.findByUserIdInDateRange as any).mockResolvedValue([]);
        (dp.dailyProgressRepository.findByUserAndDateRange as any).mockResolvedValue([]);
        (sp.studyPlanRepository.listByUser as any).mockResolvedValue([]);

        const { GET } = await import('@/app/api/profile/performance/route');
        await GET(new NextRequest('http://localhost/api/profile/performance'));
        expect(lr.learningRecordRepository.findByUserIdInDateRange).toHaveBeenCalledWith(
            'u3',
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/),
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/),
        );
    });
});
