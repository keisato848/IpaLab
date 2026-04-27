import { ensureContainer } from '@/lib/cosmos';
import { DailyProgress, DailyProgressSchema } from '@ipa-lab/shared';
import { SqlQuerySpec } from '@azure/cosmos';

/**
 * 日次進捗集計レポジトリ。
 *
 * - PartitionKey: /userId
 * - id: `${userId}-${date}` (UTC YYYY-MM-DD)
 *
 * 関連 Issue: #187 (P2-A-1)
 */
export const dailyProgressRepository = {
    containerName: 'DailyProgress',

    async upsert(item: DailyProgress): Promise<DailyProgress> {
        const validated = DailyProgressSchema.parse(item);
        const container = await ensureContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        const { resource } = await container.items.upsert(validated);
        if (!resource) throw new Error('Failed to upsert daily progress');
        return resource as unknown as DailyProgress;
    },

    async upsertMany(items: DailyProgress[]): Promise<number> {
        if (items.length === 0) return 0;
        let n = 0;
        for (const it of items) {
            await this.upsert(it);
            n += 1;
        }
        return n;
    },

    async findByUserAndDateRange(userId: string, from: string, to: string): Promise<DailyProgress[]> {
        const container = await ensureContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        const querySpec: SqlQuerySpec = {
            query:
                'SELECT * FROM c WHERE c.userId = @userId AND c.date >= @from AND c.date <= @to ORDER BY c.date ASC',
            parameters: [
                { name: '@userId', value: userId },
                { name: '@from', value: from },
                { name: '@to', value: to },
            ],
        };
        const { resources } = await container.items.query(querySpec).fetchAll();
        return resources as DailyProgress[];
    },
};
