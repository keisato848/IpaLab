import * as fs from 'fs';
import * as path from 'path';

const questionsDir = path.resolve(__dirname, '../../data/questions');

function main() {
    console.log("Analyzing AP Morning Exams for missing explanations...");

    // 1. Find AP AM folders
    const dirs = fs.readdirSync(questionsDir).filter(d =>
        d.startsWith('AP-') && d.endsWith('-AM')
    );

    let totalMissing = 0;
    let totalQuestions = 0;
    const report: string[] = [];

    for (const dir of dirs) {
        const jsonPath = path.join(questionsDir, dir, 'questions_raw.json');
        if (!fs.existsSync(jsonPath)) continue;

        try {
            const content = fs.readFileSync(jsonPath, 'utf-8');
            const data = JSON.parse(content);
            const questions = Array.isArray(data) ? data : data.questions;

            let missingInFile = 0;

            for (const q of questions) {
                totalQuestions++;
                // Check if explanation is missing or short
                if (!q.explanation || q.explanation.trim().length < 10) {
                    missingInFile++;
                }
            }

            if (missingInFile > 0) {
                totalMissing += missingInFile;
                // report.push(`${dir}: ${missingInFile} missing`);
            }

        } catch (e) {
            console.error(`Error reading ${dir}: ${e}`);
        }
    }

    console.log(`\nAnalysis Result:`);
    console.log(`Total AP AM Exams Scanned: ${dirs.length}`);
    console.log(`Total Questions Scanned: ${totalQuestions}`);
    console.log(`Questions with Missing/Short Explanations: ${totalMissing}`);
    console.log(`Missing Rate: ${((totalMissing / totalQuestions) * 100).toFixed(1)}%`);
}

main();
