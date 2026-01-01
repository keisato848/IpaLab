
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

interface Question {
    qNo: number;
    text: string;
    options: any[];
    correctOption: string | null;
    category?: string;
    subCategory?: string;
}

const mapCategory = (qNo: number): string => {
    if (qNo <= 50) return 'Technology';
    if (qNo <= 60) return 'Management';
    if (qNo <= 80) return 'Strategy';
    return 'Technology';
};

const mapSubCategory = (qNo: number): string => {
    if (qNo <= 5) return '基礎理論'; // Basic Theory
    if (qNo <= 10) return 'アルゴリズムとプログラミング'; // Algorithms & Programming
    if (qNo <= 25) return 'コンピュータシステム'; // Computer System
    if (qNo <= 35) return '技術要素'; // DB, Network
    if (qNo <= 45) return 'セキュリティ'; // Security
    if (qNo <= 50) return 'システム開発技術'; // System Development
    if (qNo <= 60) return 'プロジェクト・サービスマネジメント'; // Project & Service Mgmt
    if (qNo <= 80) return 'システム戦略・経営戦略'; // Strategy
    return 'General';
};

const DATA_DIR = path.resolve(__dirname, '../../data/questions');

async function main() {
    console.log(`Scanning for AP AM questions in ${DATA_DIR}...`);

    // Glob all questions_raw.json in AP-* folders
    // We target AP-*-AM folders strictly to avoid touching PM or FE for now if schema differs
    const files = glob.sync('AP-*-AM/questions_raw.json', { cwd: DATA_DIR });

    console.log(`Found ${files.length} exam files to process.`);

    let updatedCount = 0;

    for (const file of files) {
        const fullPath = path.join(DATA_DIR, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        let questions: Question[];

        try {
            questions = JSON.parse(content);
        } catch (e) {
            console.error(`Failed to parse ${file}: ${e}`);
            continue;
        }

        if (!Array.isArray(questions)) {
            console.warn(`Skipping ${file}: content is not an array (likely PM exam)`);
            continue;
        }

        let fileModified = false;
        questions = questions.map(q => {
            const newCat = mapCategory(q.qNo);
            const newSub = mapSubCategory(q.qNo);

            if (q.category !== newCat || q.subCategory !== newSub) {
                fileModified = true;
                return {
                    ...q,
                    category: newCat,
                    subCategory: newSub
                };
            }
            return q;
        });

        if (fileModified) {
            fs.writeFileSync(fullPath, JSON.stringify(questions, null, 2));
            console.log(`Updated ${file}`);
            updatedCount++;
        }
    }

    console.log(`Finished. Updated ${updatedCount} files.`);
}

main();
