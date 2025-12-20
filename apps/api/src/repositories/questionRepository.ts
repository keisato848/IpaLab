import { containers } from '../services/cosmos';
import { Question, QuestionSchema, ExamType } from '@ipa-lab/shared';
import { SqlQuerySpec } from '@azure/cosmos';

export const questionRepository = {
    async getById(id: string, examId: string): Promise<Question | null> {
        const { resource } = await containers.questions.item(id, examId).read();
        if (!resource) return null;
        return resource as Question;
    },

    async listByExamId(examId: string): Promise<Question[]> {
        const querySpec: SqlQuerySpec = {
            query: "SELECT * FROM c WHERE c.examId = @examId",
            parameters: [{ name: "@examId", value: examId }]
        };
        const { resources } = await containers.questions.items.query(querySpec).fetchAll();
        return resources as Question[];
    },

    async create(question: Question): Promise<Question> {
        // Validation
        const validated = QuestionSchema.parse(question);
        const { resource } = await containers.questions.items.create(validated);
        return resource as Question;
    },

    // For Analytics/SubCategory filtering
    async listBySubCategory(subCategory: string): Promise<Question[]> {
        const querySpec: SqlQuerySpec = {
            query: "SELECT * FROM c WHERE c.subCategory = @subCategory",
            parameters: [{ name: "@subCategory", value: subCategory }]
        };
        // Note: Cross-partition query if examId is PK. For analytics this might be acceptable or require optimized secondary index.
        const { resources } = await containers.questions.items.query(querySpec).fetchAll();
        return resources as Question[];
    }
};
