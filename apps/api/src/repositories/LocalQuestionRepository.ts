import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import fm from 'front-matter';
import { Question, ExamTypes, OptionSchema } from '@ipa-lab/shared';

// Relative path logic relies on built structure in dist, or we use standard path resolution.
// Assuming we run from dist/src/functions or similar.
// For local dev with ts-node/func host, __dirname might be src/repositories.
// Let's protect against path variance.

const findDataRoot = (startPath: string): string => {
    // Priority 1: Production (dist/data)
    // Structure: dist/src/repositories -> dist/data
    const prodPath = path.resolve(startPath, '../../../data');
    if (existsSync(prodPath)) {
        return prodPath;
    }

    // Priority 2: Monorepo Dev (packages/data/data)
    return path.resolve(startPath, '../../../../../packages/data/data');
};

const DATA_ROOT = findDataRoot(__dirname);

interface QuestionFrontMatter {
    id: string;
    qNo: number;
    category: string;
    subCategory?: string;
}

interface ExamAnswers {
    examId: string;
    answers: { qNo: number; correct: string }[];
}

export const localQuestionRepository = {
    async getById(id: string, examId: string): Promise<Question | null> {
        // ID format: AP-2023-Fall-AM-1 -> We need qNo 1
        // Assuming ID ends with qNo, or we rely on list logic.
        const parts = id.split('-');
        const qNo = parseInt(parts[parts.length - 1]);

        const questions = await this.listByExamId(examId);
        return questions.find(q => q.id === id) || null;
    },

    async listByExamId(examId: string): Promise<Question[]> {
        const questionsDir = path.join(DATA_ROOT, 'questions', examId);

        try {
            await fs.access(questionsDir);
        } catch {
            console.warn(`LocalQuestionRepository: No questions found for ${examId}`);
            return [];
        }

        // Read Questions
        const files = await fs.readdir(questionsDir);
        const results: Question[] = [];

        for (const file of files) {
            // Updated to read .json files
            if (!file.endsWith('.json')) continue;

            const content = await fs.readFile(path.join(questionsDir, file), 'utf-8');
            try {
                const q: Question = JSON.parse(content);
                // Ensure required fields
                if (q.id && q.text && q.options) {
                    results.push(q);
                }
            } catch (e) {
                console.error(`Failed to parse ${file}:`, e);
            }
        }

        return results.sort((a, b) => (a.qNo || 0) - (b.qNo || 0));
    },

    async create(question: Question): Promise<Question> {
        throw new Error('LocalQuestionRepository: Create not supported (Read Only)');
    },

    async listBySubCategory(subCategory: string): Promise<Question[]> {
        return [];
    }
};
