import fs from 'fs/promises';
import path from 'path';
import fm from 'front-matter';
import { CosmosClient } from '@azure/cosmos';

// Configuration
const DATA_DIR = path.resolve(__dirname, '../../data');
const VERIFIED_DIR = path.join(DATA_DIR, 'verified');
const QUESTIONS_DIR = path.join(DATA_DIR, 'questions');

// DB Stub (Replace with real client usage or @ipa-lab/api repo)
// For MVP, we use Dry Run by default.
const DB_CONFIG = {
    endpoint: process.env.COSMOS_ENDPOINT || 'https://localhost:8081',
    key: process.env.COSMOS_KEY || 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
    databaseId: 'IpaLabDb',
    containerId: 'Questions'
};

interface QuestionFrontMatter {
    id: string;
    qNo: number;
    category: string;
    subCategory?: string;
}

interface AnswerData {
    qNo: number;
    correct: string;
}

interface ExamAnswers {
    examId: string;
    answers: AnswerData[];
}

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run') || true; // Default to dry run for safety

    console.log(`Starting Data Sync (Dry Run: ${isDryRun})...`);

    // 1. Read Verified Answer Files
    const files = await fs.readdir(VERIFIED_DIR);
    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        console.log(`Processing file: ${file}`);
        const filePath = path.join(VERIFIED_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const examData: ExamAnswers = JSON.parse(content);
        const { examId, answers } = examData;

        // 2. Find corresponding Question Markdowns
        const examQuestionsDir = path.join(QUESTIONS_DIR, examId);
        try {
            await fs.access(examQuestionsDir);
        } catch {
            console.warn(`No questions found for ${examId} in ${examQuestionsDir}`);
            continue;
        }

        const qFiles = await fs.readdir(examQuestionsDir);
        const dbItems = [];

        for (const qFile of qFiles) {
            if (!qFile.endsWith('.md')) continue;

            const qContent = await fs.readFile(path.join(examQuestionsDir, qFile), 'utf-8');
            const parsed = fm<QuestionFrontMatter>(qContent);
            const { attributes, body } = parsed;

            // 3. Merge Answer Data
            const answer = answers.find(a => a.qNo === attributes.qNo);
            if (!answer) {
                console.warn(`No answer found for Q${attributes.qNo} in ${examId}`);
                continue;
            }

            // 4. Transform to DB Object
            const dbItem = {
                id: `${examId}-${attributes.qNo}`, // Unique ID
                examId: examId,
                qNo: attributes.qNo,
                category: attributes.category,
                subCategory: attributes.subCategory,
                questionText: body, // Contains Question, Options, Explanation in MD
                correctOption: answer.correct,
                type: 'question' // Discriminator
            };

            dbItems.push(dbItem);
        }

        console.log(`Prepared ${dbItems.length} questions for ${examId}.`);

        // 5. Upsert to DB (Dry Run Log)
        if (isDryRun) {
            console.log('--- DRY RUN: Would Insert ---');
            console.log(JSON.stringify(dbItems.slice(0, 2), null, 2));
            console.log(`... and ${dbItems.length - 2} more items.`);
            console.log('-----------------------------');
        } else {
            // TODO: Real DB Insert Logic
            // await container.items.upsert(item);
        }
    }
}

main().catch(console.error);
