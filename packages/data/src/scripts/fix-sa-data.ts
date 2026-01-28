
import fs from 'fs';
import path from 'path';

const examId = 'SA-2024-Spring-AM2';
const baseDir = path.resolve(__dirname, '../../data/questions', examId);
const questionsPath = path.join(baseDir, 'questions_raw.json');
const answersPath = path.join(baseDir, 'answers_raw.json');

async function main() {
    console.log(`Fixing data for ${examId}...`);

    if (!fs.existsSync(questionsPath) || !fs.existsSync(answersPath)) {
        console.error(`Files not found in ${baseDir}`);
        process.exit(1);
    }

    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
    const answersData = JSON.parse(fs.readFileSync(answersPath, 'utf8'));

    // Handle structure variations
    const questions = Array.isArray(questionsData) ? questionsData : questionsData.questions;

    // Normalized answer map
    const answerMap = new Map<number, string>();

    // Check validation of answersData structure
    if (Array.isArray(answersData)) {
        answersData.forEach((a: any) => answerMap.set(a.qNo, a.correctOption));
    } else if (answersData.answers) {
        // if it has a .answers property
        answersData.answers.forEach((a: any) => answerMap.set(a.qNo, a.correctOption));
    } else {
        // Key-value pairs "1": "a", "2": "b"
        Object.entries(answersData).forEach(([key, val]) => {
            answerMap.set(parseInt(key), val as string);
        });
    }

    console.log(`Loaded ${answerMap.size} answers.`);

    let updatedCount = 0;
    for (const q of questions) {
        const correct = answerMap.get(q.qNo);
        if (correct) {
            if (q.correctOption !== correct) {
                q.correctOption = correct;
                updatedCount++;
            }
        } else {
            console.warn(`No answer found for Q${q.qNo}`);
        }
    }

    if (updatedCount > 0) {
        console.log(`Updated ${updatedCount} questions.`);
        fs.writeFileSync(questionsPath, JSON.stringify(questionsData, null, 2), 'utf8');
        console.log('Saved questions_raw.json');
    } else {
        console.log('No changes needed.');
    }

}

main().catch(console.error);
