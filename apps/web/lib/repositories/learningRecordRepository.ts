import { getContainer } from '@/lib/cosmos';
import { LearningRecord, LearningRecordSchema } from '@ipa-lab/shared';
import { SqlQuerySpec } from '@azure/cosmos';

export const learningRecordRepository = {
    containerName: "LearningRecords",

    async save(record: LearningRecord): Promise<LearningRecord> {
        // Validate
        // Note: In API we used LearningRecordSchema.parse(record), here we ensure types match
        // We cast to any to satisfy parser if strict types differ slightly or verify strictness
        const validated = LearningRecordSchema.parse(record);
        const container = await getContainer(this.containerName);
        const { resource } = await container.items.upsert(validated);
        if (!resource) throw new Error('Failed to save learning record');
        return resource as unknown as LearningRecord;
    },

    async findByUserId(userId: string): Promise<LearningRecord[]> {
        const container = await getContainer(this.containerName);
        const querySpec: SqlQuerySpec = {
            query: "SELECT * FROM c WHERE c.userId = @userId",
            parameters: [{ name: "@userId", value: userId }]
        };
        const { resources } = await container.items.query(querySpec).fetchAll();
        return resources as LearningRecord[];
    },

    async listByUserId(userId: string): Promise<LearningRecord[]> {
        return this.findByUserId(userId);
    },

    async listByUserAndExamId(userId: string, examId: string): Promise<LearningRecord[]> {
        const container = await getContainer(this.containerName);
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
