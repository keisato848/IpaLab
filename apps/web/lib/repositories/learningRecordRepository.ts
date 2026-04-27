import { ensureContainer } from '@/lib/cosmos';
import { LearningRecord, LearningRecordSchema } from '@ipa-lab/shared';
import { SqlQuerySpec } from '@azure/cosmos';

export const learningRecordRepository = {
    containerName: "LearningRecords",

    async save(record: LearningRecord): Promise<LearningRecord> {
        // Validate
        // Note: In API we used LearningRecordSchema.parse(record), here we ensure types match
        // We cast to any to satisfy parser if strict types differ slightly or verify strictness
        const validated = LearningRecordSchema.parse(record);
        const container = await ensureContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        const { resource } = await container.items.upsert(validated);
        if (!resource) throw new Error('Failed to save learning record');
        return resource as unknown as LearningRecord;
    },

    async findByUserId(userId: string): Promise<LearningRecord[]> {
        const container = await ensureContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        const querySpec: SqlQuerySpec = {
            query: "SELECT * FROM c WHERE c.userId = @userId",
            parameters: [{ name: "@userId", value: userId }]
        };
        const { resources } = await container.items.query(querySpec).fetchAll();
        return resources as LearningRecord[];
    },

    /**
     * 指定期間 (answeredAt が fromIso 以上 toIso 未満) の LearningRecord を返す。
     * #224 v2.0 MVP3: PerformanceProfile が直近28日分しか必要としないため、
     * Cosmos の RU/レイテンシ削減のために範囲を絞って取得する。
     *
     * fromIso/toIso は ISO datetime 文字列 (例: '2026-04-01T00:00:00.000Z')。
     */
    async findByUserIdInDateRange(
        userId: string,
        fromIso: string,
        toIso: string,
    ): Promise<LearningRecord[]> {
        const container = await ensureContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        const querySpec: SqlQuerySpec = {
            query:
                "SELECT * FROM c WHERE c.userId = @userId AND c.answeredAt >= @from AND c.answeredAt < @to",
            parameters: [
                { name: "@userId", value: userId },
                { name: "@from", value: fromIso },
                { name: "@to", value: toIso },
            ],
        };
        const { resources } = await container.items.query(querySpec).fetchAll();
        return resources as LearningRecord[];
    },

    async listByUserId(userId: string): Promise<LearningRecord[]> {
        return this.findByUserId(userId);
    },

    async listByUserAndExamId(userId: string, examId: string): Promise<LearningRecord[]> {
        const container = await ensureContainer(this.containerName);
        if (!container) throw new Error('Database not initialized');
        const querySpec: SqlQuerySpec = {
            query: "SELECT * FROM c WHERE c.userId = @userId AND c.examId = @examId",
            parameters: [
                { name: "@userId", value: userId },
                { name: "@examId", value: examId }
            ]
        };
        const { resources } = await container.items.query(querySpec).fetchAll();
        return resources as LearningRecord[];
    }
};
