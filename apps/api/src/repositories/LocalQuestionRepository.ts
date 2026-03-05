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

// In-memory cache for questions (reduces filesystem access on repeated requests)
const questionCache = new Map<string, { data: Question[]; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const localQuestionRepository = {
    // Clear cache for specific exam or all
    clearCache(examId?: string): void {
        if (examId) {
            questionCache.delete(examId);
        } else {
            questionCache.clear();
        }
    },

    async getById(id: string, examId: string): Promise<Question | null> {
        // ID format: AP-2023-Fall-AM-1 -> We need qNo 1
        // Assuming ID ends with qNo, or we rely on list logic.
        const parts = id.split('-');
        const qNo = parseInt(parts[parts.length - 1]);

        const questions = await this.listByExamId(examId);
        return questions.find(q => q.id === id) || null;
    },

    async listByExamId(examId: string): Promise<Question[]> {
        // Check cache first
        const now = Date.now();
        const cached = questionCache.get(examId);
        if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
            return cached.data;
        }

        const questionsDir = path.join(DATA_ROOT, 'questions', examId);

        try {
            await fs.access(questionsDir);
        } catch {
            console.warn(`LocalQuestionRepository: No questions found for ${examId}`);
            return [];
        }

        // questions_transformed.json を優先、なければ questions_raw.json にフォールバック
        // q*.json は questions_raw.json と重複するため読み込まない
        const transformedPath = path.join(questionsDir, 'questions_transformed.json');
        const rawPath = path.join(questionsDir, 'questions_raw.json');

        let targetFile: string | null = null;
        if (existsSync(transformedPath)) {
            targetFile = transformedPath;
        } else if (existsSync(rawPath)) {
            targetFile = rawPath;
        }

        const results: Question[] = [];

        if (!targetFile) {
            console.warn(`LocalQuestionRepository: No data file found for ${examId}`);
            return [];
        }

        try {
            const content = await fs.readFile(targetFile, 'utf-8');
            const json = JSON.parse(content);
            let items: any[] = [];

            if (Array.isArray(json)) {
                items = json;
            } else if (json.questions && Array.isArray(json.questions)) {
                items = json.questions;
            } else {
                items = [json];
            }

            for (const q of items) {
                // PM questions might have description/context instead of simple text
                // And might not have options.
                if (q.qNo || q.id) {
                    // Inject Metadata if missing
                    if (!q.examId) q.examId = examId;
                    if (!q.id) q.id = `${examId}-${q.qNo}`;
                    
                    results.push(q as Question);
                }
            }
        } catch (e) {
            console.error(`Failed to parse ${path.basename(targetFile)}:`, e);
        }

        const sorted = results.sort((a, b) => (a.qNo || 0) - (b.qNo || 0));

        // Update cache
        questionCache.set(examId, { data: sorted, timestamp: Date.now() });

        return sorted;
    },

    async create(question: Question): Promise<Question> {
        throw new Error('LocalQuestionRepository: Create not supported (Read Only)');
    },

    async listBySubCategory(subCategory: string): Promise<Question[]> {
        return [];
    }
};
