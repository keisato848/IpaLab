
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const dataDir = path.resolve(__dirname, '../../data/questions');

function main() {
    const files = glob.sync('**/questions_raw.json', { cwd: dataDir });
    console.log(`Found ${files.length} files to check.`);
    const report: Record<string, { total: number, missing: number, rate: string }> = {};

    for (const file of files) {
        // console.log(`Checking ${file}...`); 
        const fullPath = path.join(dataDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        try {
            const data = JSON.parse(content);
            const questions = Array.isArray(data) ? data : (data.questions || []);
            if (file.includes('AP-2025-Fall-AM')) {
                console.log(`DEBUG: Checking ${file}`);
                console.log(`DEBUG: Is Array? ${Array.isArray(questions)} Length: ${questions.length}`);
                if (questions.length > 0) {
                    console.log(`DEBUG: Q1 Options: ${JSON.stringify(questions[0].options)}`);
                    console.log(`DEBUG: Q1 Correct: ${questions[0].correctOption} (Type: ${typeof questions[0].correctOption})`);
                }
            }

            let missingCount = 0;
            // Only check AM/AM1/AM2/IP (PM usually doesn't have simple correctOption)
            // But user said "Morning exams".

            for (const q of questions) {
                // If options exist, we expect correctOption
                if (q.options && q.options.length > 0) {
                    if (!q.correctOption) {
                        missingCount++;
                    }
                }
            }

            if (missingCount > 0) {
                const examId = path.dirname(file).split(path.sep).pop();
                report[examId!] = {
                    total: questions.length,
                    missing: missingCount,
                    rate: ((missingCount / questions.length) * 100).toFixed(1) + '%'
                };
            }
        } catch (e) {
            console.error(`Error parsing ${file}`);
        }
    }

    console.log("=== MISSING CORRECT OPTIONS REPORT ===");
    console.table(report);
}

main();
