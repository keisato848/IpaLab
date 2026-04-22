import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));

vi.mock('@/auth', () => ({
    authOptions: {},
}));

vi.mock('@/lib/repositories/studyPlanRepository', () => ({
    studyPlanRepository: {
        listByUser: vi.fn(),
        findById: vi.fn(),
        upsert: vi.fn(),
        upsertMany: vi.fn(),
        remove: vi.fn(),
    },
}));

import { getServerSession } from 'next-auth';
import { studyPlanRepository } from '@/lib/repositories/studyPlanRepository';
import { GET as listGET, POST as listPOST } from '@/app/api/study-plan/route';
import { GET as itemGET, PUT as itemPUT, DELETE as itemDELETE } from '@/app/api/study-plan/[id]/route';

const mockGetServerSession = vi.mocked(getServerSession);
const mockRepo = vi.mocked(studyPlanRepository);

const validPlan = {
    id: 'plan-1',
    title: 't',
    examDate: '2026-04-21',
    monthlyGoal: 'g',
    weeklySchedule: [
        {
            weekNumber: 1,
            startDate: '2026-04-15',
            endDate: '2026-04-21',
            goal: 'w',
            dailyTasks: [{ date: '2026-04-15', goal: 'g', questionCount: 10 }],
        },
    ],
    generatedAt: '2026-01-01T00:00:00.000Z',
};

const makeReq = (body?: unknown, url = 'http://localhost/api/study-plan') =>
    ({ json: async () => body, url } as any);

describe('study-plan API routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/study-plan', () => {
        it('未認証は 401', async () => {
            mockGetServerSession.mockResolvedValue(null as any);
            const res = await listGET();
            expect(res.status).toBe(401);
        });

        it('認証済みは listByUser の結果を返す', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            mockRepo.listByUser.mockResolvedValue([validPlan as any]);
            const res = await listGET();
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toHaveLength(1);
            expect(mockRepo.listByUser).toHaveBeenCalledWith('u1');
        });
    });

    describe('POST /api/study-plan', () => {
        it('未認証は 401', async () => {
            mockGetServerSession.mockResolvedValue(null as any);
            const res = await listPOST(makeReq(validPlan));
            expect(res.status).toBe(401);
        });

        it('単一 plan を upsert', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            mockRepo.upsert.mockResolvedValue(validPlan as any);
            const res = await listPOST(makeReq(validPlan));
            expect(res.status).toBe(200);
            expect(mockRepo.upsert).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'plan-1' }));
        });

        it('配列は upsertMany にルーティング', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            mockRepo.upsertMany.mockResolvedValue(2);
            const res = await listPOST(makeReq([validPlan, { ...validPlan, id: 'plan-2' }]));
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual({ count: 2 });
        });

        it('不正データは 400', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            const res = await listPOST(makeReq({ id: 'x' }));
            expect(res.status).toBe(400);
        });
    });

    describe('PUT /api/study-plan/[id]', () => {
        it('id 不一致は 400', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            const res = await itemPUT(makeReq(validPlan), { params: Promise.resolve({ id: 'different' }) });
            expect(res.status).toBe(400);
        });

        it('id 一致なら upsert', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            mockRepo.upsert.mockResolvedValue(validPlan as any);
            const res = await itemPUT(makeReq(validPlan), { params: Promise.resolve({ id: 'plan-1' }) });
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/study-plan/[id]', () => {
        it('未存在は 404', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            mockRepo.findById.mockResolvedValue(null);
            const res = await itemGET(makeReq(), { params: Promise.resolve({ id: 'missing' }) });
            expect(res.status).toBe(404);
        });

        it('存在すれば 200 で返す', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            mockRepo.findById.mockResolvedValue(validPlan as any);
            const res = await itemGET(makeReq(), { params: Promise.resolve({ id: 'plan-1' }) });
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/study-plan/[id]', () => {
        it('未認証は 401', async () => {
            mockGetServerSession.mockResolvedValue(null as any);
            const res = await itemDELETE(makeReq(), { params: Promise.resolve({ id: 'plan-1' }) });
            expect(res.status).toBe(401);
        });
        it('成功時は { ok: true }', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            mockRepo.remove.mockResolvedValue(true);
            const res = await itemDELETE(makeReq(), { params: Promise.resolve({ id: 'plan-1' }) });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual({ ok: true });
        });
        it('未存在は 404', async () => {
            mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } } as any);
            mockRepo.remove.mockResolvedValue(false);
            const res = await itemDELETE(makeReq(), { params: Promise.resolve({ id: 'missing' }) });
            expect(res.status).toBe(404);
        });
    });
});
