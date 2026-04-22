import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn(),
}));

import { getContainer } from '@/lib/cosmos';
import { studyPlanRepository } from '@/lib/repositories/studyPlanRepository';
import type { StudyPlan } from '@/lib/types/studyPlan';

const mockGetContainer = vi.mocked(getContainer);

const samplePlan: StudyPlan = {
    id: 'plan-1',
    title: 'AP 春',
    examDate: '2026-04-21',
    monthlyGoal: '基礎理論を固める',
    weeklySchedule: [
        {
            weekNumber: 1,
            startDate: '2026-04-15',
            endDate: '2026-04-21',
            goal: 'w1',
            dailyTasks: [
                { date: '2026-04-15', goal: 'task', questionCount: 10 },
            ],
        },
    ],
    generatedAt: '2026-01-01T00:00:00.000Z',
};

describe('studyPlanRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('listByUser: userId で絞った計画一覧を返し、userId を剥がす', async () => {
        const fetchAllMock = vi.fn().mockResolvedValue({
            resources: [{ ...samplePlan, userId: 'u1' }],
        });
        const queryMock = vi.fn(() => ({ fetchAll: fetchAllMock }));
        mockGetContainer.mockResolvedValue({ items: { query: queryMock } } as any);

        const result = await studyPlanRepository.listByUser('u1');

        expect(queryMock).toHaveBeenCalledWith(
            expect.objectContaining({
                parameters: [{ name: '@userId', value: 'u1' }],
            }),
        );
        expect(result).toHaveLength(1);
        expect(result[0]).not.toHaveProperty('userId');
        expect(result[0].id).toBe('plan-1');
    });

    it('upsert: zod 検証を通り、保存後の resource から userId を剥がして返す', async () => {
        const upsertMock = vi.fn().mockResolvedValue({
            resource: { ...samplePlan, userId: 'u1' },
        });
        mockGetContainer.mockResolvedValue({ items: { upsert: upsertMock } } as any);

        const saved = await studyPlanRepository.upsert('u1', samplePlan);

        expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', id: 'plan-1' }));
        expect(saved).not.toHaveProperty('userId');
        expect(saved.id).toBe('plan-1');
    });

    it('upsertMany: 複数件を順次 upsert し件数を返す', async () => {
        const upsertMock = vi.fn().mockResolvedValue({ resource: { ...samplePlan, userId: 'u1' } });
        mockGetContainer.mockResolvedValue({ items: { upsert: upsertMock } } as any);

        const n = await studyPlanRepository.upsertMany('u1', [samplePlan, { ...samplePlan, id: 'plan-2' }]);

        expect(n).toBe(2);
        expect(upsertMock).toHaveBeenCalledTimes(2);
    });

    it('findById: 404 時は null を返す', async () => {
        const readMock = vi.fn().mockRejectedValue({ code: 404 });
        const itemMock = vi.fn(() => ({ read: readMock }));
        mockGetContainer.mockResolvedValue({ item: itemMock } as any);

        const result = await studyPlanRepository.findById('u1', 'missing');

        expect(result).toBeNull();
        expect(itemMock).toHaveBeenCalledWith('missing', 'u1');
    });

    it('remove: 404 時は false、成功時は true', async () => {
        const deleteOk = vi.fn().mockResolvedValue({});
        mockGetContainer.mockResolvedValue({ item: () => ({ delete: deleteOk }) } as any);
        await expect(studyPlanRepository.remove('u1', 'plan-1')).resolves.toBe(true);

        const deleteNotFound = vi.fn().mockRejectedValue({ statusCode: 404 });
        mockGetContainer.mockResolvedValue({ item: () => ({ delete: deleteNotFound }) } as any);
        await expect(studyPlanRepository.remove('u1', 'missing')).resolves.toBe(false);
    });

    it('upsert: 不正な plan は zod でエラー', async () => {
        const badPlan = { id: 'p', title: 't' } as unknown as StudyPlan;
        await expect(studyPlanRepository.upsert('u1', badPlan)).rejects.toThrow();
    });
});
