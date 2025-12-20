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
        return resource as LearningRecord;
    },

    async listByUserId(userId: string): Promise<LearningRecord[]> {
        const querySpec: SqlQuerySpec = {
            query: "SELECT * FROM c WHERE c.userId = @userId",
            parameters: [{ name: "@userId", value: userId }]
        };
        const { resources } = await containers.learningRecords.items.query(querySpec).fetchAll();
        return resources as LearningRecord[];
    }
};
