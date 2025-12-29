import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Duplicate logic from LocalQuestionRepository
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

export interface Exam {
    id: string;
    title: string;
    date: string;
    category: string;
    stats?: {
        total: number;
        completed: number;
        correctRate: number;
    };
}

export const localExamRepository = {
    async list(): Promise<Exam[]> {
        const questionsDir = path.join(DATA_ROOT, 'questions');
        try {
            await fs.access(questionsDir);
        } catch {
            console.warn(`LocalExamRepository: Questions directory not found at ${questionsDir}`);
            return [];
        }

        const dirs = await fs.readdir(questionsDir);
        const exams: Exam[] = [];

        for (const dir of dirs) {
            // Check if it's a real exam (not sample)
            try {
                const q1Path = path.join(questionsDir, dir, 'q1.json');
                const q1Content = await fs.readFile(q1Path, 'utf-8');
                const q1 = JSON.parse(q1Content);
                if (q1.text && q1.text.includes('【サンプル問題】')) {
                    continue; // Skip samples
                }
            } catch (e) {
                // If q1.json is missing or invalid, skip
                continue;
            }

            // Expected format: AP-YYYY-Term-Type (e.g., AP-2016-Fall-AM)
            const parts = dir.split('-');
            if (parts.length < 3) continue;

            const category = parts[0];
            const year = parseInt(parts[1]);

            let era = '';
            if (year >= 2019) era = `令和${year - 2018}年`;
            else if (year >= 1989) era = `平成${year - 1988}年`;

            const term = parts[2] === 'Spring' ? '春期' : (parts[2] === 'Fall' ? '秋期' : parts[2]);

            let typeLabel = '';
            if (parts[3] === 'AM') typeLabel = '午前';
            else if (parts[3] === 'AM1') typeLabel = '午前I';
            else if (parts[3] === 'AM2') typeLabel = '午前II';
            else if (parts[3] === 'PM') typeLabel = '午後';
            else typeLabel = parts[3] || '';

            let categoryLabel = '応用情報技術者試験'; // Default AP
            if (category === 'PM') categoryLabel = 'プロジェクトマネージャ試験';
            else if (category === 'FE') categoryLabel = '基本情報技術者試験';

            const title = `${categoryLabel} ${era} ${term} ${typeLabel}`;

            exams.push({
                id: dir,
                title: title,
                date: `${year}-01-01`,
                category: category,
                stats: { total: 80, completed: 0, correctRate: 0 }
            });
        }

        return exams.sort((a, b) => b.id.localeCompare(a.id));
    }
};
