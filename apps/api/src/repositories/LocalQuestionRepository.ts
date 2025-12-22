import fs from 'fs/promises';
import path from 'path';
import fm from 'front-matter';
import { Question, ExamTypes, OptionSchema } from '@ipa-lab/shared';

// Relative path from dist/src/repositories/LocalQuestionRepository.js to packages/data/data
// Structure:
// dist/
//   src/
//     repositories/
//       LocalQuestionRepository.js
// ../../../../../packages/data/data
const DATA_ROOT = path.resolve(__dirname, '../../../../../packages/data/data');

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
        // Let's implement listByExamId first and filter, or parse ID.
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

            // Simple body parsing logic to extract options if they are in markdown list
            // For MVP, we might hardcode options or parse them better in Syncer.
            // Here we assume body contains everything.
            // Ideally, the Syncer logic (markdown -> object) should be shared or this repo matches it.

            const q: Question = {
                id: `${examId}-${attributes.qNo}`,
                examId: examId,
                type: 'AM1', // Mock or derive from ExamID
                category: attributes.category,
                subCategory: attributes.subCategory,
                text: body, // TODO: Separate Question / Explanation / Options
                options: [
                    { id: 'a', text: 'Option A' },
                    { id: 'b', text: 'Option B' },
                    { id: 'c', text: 'Option C' },
                    { id: 'd', text: 'Option D' }
                ], // Mock options if not parsed
                correctOption: answersMap[attributes.qNo] || 'a',
                explanation: 'Explanation text from markdown...'
            };
            results.push(q);
        }

        return results.sort((a, b) => {
            const noA = parseInt(a.id.split('-').pop() || '0');
            const noB = parseInt(b.id.split('-').pop() || '0');
            return noA - noB;
        });
    },

    async create(question: Question): Promise<Question> {
        throw new Error('LocalQuestionRepository: Create not supported (Read Only)');
    },

    async listBySubCategory(subCategory: string): Promise<Question[]> {
        // Implement if needed by iterating all folders
        return [];
    }
};
