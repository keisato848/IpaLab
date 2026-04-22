import { getContainer } from '@/lib/cosmos';
import type { SqlQuerySpec } from '@azure/cosmos';
import { StoredStudyPlanSchema, type StoredStudyPlan } from '@/lib/types/studyPlanSchema';
import type { StudyPlan } from '@/lib/types/studyPlan';

/**
 * 学習計画リポジトリ (#212)
 *
 * - Container: `StudyPlan`
 * - PartitionKey: `/userId`
 * - id: クライアント側で `crypto.randomUUID()` 生成済みのものを利用
 *
 * 本リポジトリは Server Component / Route Handler からのみ呼ばれる前提。
 * 認可は呼び出し側（Route Handler）で `session.user.id` を userId として渡すこと。
 */
export const studyPlanRepository = {
    containerName: 'StudyPlan',

    async listByUser(userId: string): Promise<StudyPlan[]> {
        const container = await getContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        const querySpec: SqlQuerySpec = {
            query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.examDate ASC',
            parameters: [{ name: '@userId', value: userId }],
        };
        const { resources } = await container.items.query(querySpec).fetchAll();
        return (resources as StoredStudyPlan[]).map(stripUserId);
    },

    async findById(userId: string, id: string): Promise<StudyPlan | null> {
        const container = await getContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        try {
            const { resource } = await container.item(id, userId).read<StoredStudyPlan>();
            return resource ? stripUserId(resource) : null;
        } catch (err: unknown) {
            const e = err as { code?: number; statusCode?: number };
            if (e?.code === 404 || e?.statusCode === 404) return null;
            throw err;
        }
    },

    async upsert(userId: string, plan: StudyPlan): Promise<StudyPlan> {
        const stored = StoredStudyPlanSchema.parse({ ...plan, userId });
        const container = await getContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        const { resource } = await container.items.upsert(stored);
        if (!resource) throw new Error('Failed to upsert study plan');
        return stripUserId(resource as unknown as StoredStudyPlan);
    },

    async upsertMany(userId: string, plans: StudyPlan[]): Promise<number> {
        if (plans.length === 0) return 0;
        let n = 0;
        for (const plan of plans) {
            await this.upsert(userId, plan);
            n += 1;
        }
        return n;
    },

    async remove(userId: string, id: string): Promise<boolean> {
        const container = await getContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        try {
            await container.item(id, userId).delete();
            return true;
        } catch (err: unknown) {
            const e = err as { code?: number; statusCode?: number };
            if (e?.code === 404 || e?.statusCode === 404) return false;
            throw err;
        }
    },
};

function stripUserId(stored: StoredStudyPlan): StudyPlan {
    const { userId: _userId, ...rest } = stored;
    void _userId;
    return rest as StudyPlan;
}
