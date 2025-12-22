import fs from 'fs/promises';
import path from 'path';
import fm from 'front-matter';
import { Question, ExamTypes, OptionSchema } from '@ipa-lab/shared';

// Relative path logic relies on built structure in dist, or we use standard path resolution.
// Assuming we run from dist/src/functions or similar.
// For local dev with ts-node/func host, __dirname might be src/repositories.
// Let's protect against path variance.

const findDataRoot = (startPath: string): string => {
    // Traverse up until we find packages/data
    // This is a naive implementation, better to use environment variable or fixed relative path if structure is stable.
    // Given the monorepo structure: root/apps/api/src/repositories
    // root/packages/data/data
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
        const verifiedDir = path.join(DATA_ROOT, 'verified');
        const answerFile = path.join(verifiedDir, `${examId}_answers.json`);

        try {
            await fs.access(questionsDir);
        } catch {
            console.warn(`LocalQuestionRepository: No questions found for ${examId}`);
            return [];
        }

        // Read Answers
        let answersMap: Record<number, string> = {};
        try {
            const ansContent = await fs.readFile(answerFile, 'utf-8');
            const examAnswers: ExamAnswers = JSON.parse(ansContent);
            examAnswers.answers.forEach(a => answersMap[a.qNo] = a.correct);
        } catch (e) {
            console.warn(`LocalQuestionRepository: No verified answers for ${examId}`);
        }

        // Read Questions
        const files = await fs.readdir(questionsDir);
        const results: Question[] = [];

        for (const file of files) {
            if (!file.endsWith('.md')) continue;

            const content = await fs.readFile(path.join(questionsDir, file), 'utf-8');
            const parsed = fm<QuestionFrontMatter>(content);
            const { attributes, body } = parsed;

            // TODO: Better option parsing
            const q: Question = {
                id: `${examId}-${attributes.qNo}`,
                qNo: attributes.qNo,
                examId: examId,
                type: 'AM1', // Mock
                category: attributes.category,
                subCategory: attributes.subCategory,
                text: body,
                options: [
                    { id: 'a', text: '選択肢ア' },
                    { id: 'b', text: '選択肢イ' },
                    { id: 'c', text: '選択肢ウ' },
                    { id: 'd', text: '選択肢エ' }
                ],
                correctOption: answersMap[attributes.qNo] || 'a',
                explanation: '解説はまだ実装されていません'
            };
            results.push(q);
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
