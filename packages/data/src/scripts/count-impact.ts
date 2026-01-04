import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const dataDir = path.resolve(__dirname, '../../data/questions');

function main() {
    // Target 2023, 2024, 2025 exams
    const files = glob.sync('**/*{2023,2024,2025}*/**/questions_raw.json', { cwd: dataDir });

    console.log("=== IMPACT ANALYSIS REPORT (2023-2025 Exams) ===");

    // Aggregation
    let totalQuestions = 0;
    let totalFixed = 0;
    const categoryStats: Record<string, { total: number, fixed: number }> = {};

    for (const file of files) {
        const fullPath = path.join(dataDir, file);
        // examId is folder name e.g. FE-2023-Public-AM
        const examId = path.dirname(file).split(path.sep).pop() || "UNKNOWN";
        const category = examId.split('-')[0];

        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const data = JSON.parse(content);
            const questions = Array.isArray(data) ? data : (data.questions || []);

            if (!categoryStats[category]) categoryStats[category] = { total: 0, fixed: 0 };

            for (const q of questions) {
                categoryStats[category].total++;
                totalQuestions++;
                if (q.correctOption) {
                    categoryStats[category].fixed++;
                    totalFixed++;
                }
            }
        } catch (e) {
            console.error(`Error reading ${file}: ${e}`);
        }
    }

    console.log(`\n=== Overall Stats ===`);
    console.log(`Total Questions Scanned: ${totalQuestions}`);
    console.log(`Total With Answers: ${totalFixed}`);
    console.log(`Overall Coverage: ${totalQuestions > 0 ? ((totalFixed / totalQuestions) * 100).toFixed(1) : 0}%`);

    console.log(`\n--- By Category ---`);
    for (const [cat, stats] of Object.entries(categoryStats)) {
        console.log(`${cat}: ${stats.fixed}/${stats.total} (${stats.total > 0 ? ((stats.fixed / stats.total) * 100).toFixed(1) : 0}%)`);
    }
}

main();
