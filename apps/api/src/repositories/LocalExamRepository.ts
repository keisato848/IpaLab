import fs from 'fs/promises';
import path from 'path';

// Duplicate logic from LocalQuestionRepository
const findDataRoot = (startPath: string): string => {
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
            const type = parts[3] ? (parts[3] === 'AM' ? '午前' : parts[3]) : '';

            const title = `応用情報技術者試験 ${era} ${term} ${type}`;

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
