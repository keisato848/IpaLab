import { containers } from '../services/cosmos';
import { LearningRecord, LearningRecordSchema } from '@ipa-lab/shared';
import { SqlQuerySpec } from '@azure/cosmos';

export const learningRecordRepository = {
    async save(record: LearningRecord): Promise<LearningRecord> {
        // Validate
        const validated = LearningRecordSchema.parse(record);

        // Upsert (Insert or Update)
        // LearningRecords logic might strictly allow only append (history) or update (current status).
        // For now, we assume simple create/replace based on ID.
        const { resource } = await containers.learningRecords.items.upsert(validated);
        if (!resource) {
            throw new Error('Failed to save learning record');
        }
        return resource as unknown as LearningRecord;
    },

    // Bulk save with parallel execution (batched to avoid overwhelming Cosmos)
    async saveBulk(records: LearningRecord[]): Promise<LearningRecord[]> {
        if (records.length === 0) return [];

        // Validate all records first
        const validated = records.map(r => LearningRecordSchema.parse(r));

        // Process in batches of 10 for parallel execution
        const BATCH_SIZE = 10;
        const results: LearningRecord[] = [];

        for (let i = 0; i < validated.length; i += BATCH_SIZE) {
            const batch = validated.slice(i, i + BATCH_SIZE);
            const promises = batch.map(record => 
                containers.learningRecords.items.upsert(record)
                    .then(({ resource }) => resource as unknown as LearningRecord)
            );
            const batchResults = await Promise.all(promises);
            results.push(...batchResults.filter(Boolean));
        }

        return results;
    },

    async listByUserId(userId: string): Promise<LearningRecord[]> {
        const querySpec: SqlQuerySpec = {
            query: "SELECT * FROM c WHERE c.userId = @userId",
            parameters: [{ name: "@userId", value: userId }]
        };
        const { resources } = await containers.learningRecords.items.query(querySpec).fetchAll();
        return resources as LearningRecord[];
    },

    async listByUserAndExamId(userId: string, examId: string): Promise<LearningRecord[]> {
        const querySpec: SqlQuerySpec = {
            query: "SELECT * FROM c WHERE c.userId = @userId AND c.examId = @examId",
            parameters: [
                { name: "@userId", value: userId },
                { name: "@examId", value: examId }
            ]
        };
        const { resources } = await containers.learningRecords.items.query(querySpec).fetchAll();
        return resources as LearningRecord[];
    }
};
