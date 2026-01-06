
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { jsonrepair } from 'jsonrepair';

// Load Environment
const envPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
];
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const API_KEY = (process.env.GEMINI_API_KEY_3 || process.env.GEMINI_API_KEY) as string;
if (!API_KEY) {
    console.error("No GEMINI_API_KEY found.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const DATA_DIR = path.resolve(__dirname, '../../data/questions');
const PROMPT_FILE_PATH = path.resolve(__dirname, '../../../../docs/prompts/gemini_classification_prompt.md');

// Valid Exam Filters (Start with recent ones)
const TARGET_EXAMS = [
    'FE-2024-Public-AM',
    'FE-2023-Public-AM',
    'AP-2024-Fall-AM',
    'AP-2024-Spring-AM',
    'AP-2025-Fall-AM', // Predicted
];

async function main() {
    console.log("Starting Question Classification...");

    // Load Prompt
    if (!fs.existsSync(PROMPT_FILE_PATH)) {
        console.error("Prompt file missing:", PROMPT_FILE_PATH);
        return;
    }
    const promptTemplate = fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');

    // Get all exam folders
    const allExams = fs.readdirSync(DATA_DIR).filter(f => fs.statSync(path.join(DATA_DIR, f)).isDirectory());

    // Filter target exams
    // Logic: If --all, do all.
    // If specific args, do those.
    // Default: Recent AM exams (2023+) to save time/tokens and fix immediate user issue.

    let targets: string[] = [];
    const args = process.argv.slice(2);
    if (args.includes('--all')) {
        targets = allExams;
    } else {
        // Default to Recent AM
        targets = allExams.filter(e => {
            const isAM = e.includes('-AM') && !e.includes('PM'); // AM1/AM2 or just AM
            const isRecent = e.includes('2023') || e.includes('2024') || e.includes('2025');
            const isIPA = e.startsWith('AP') || e.startsWith('FE') || e.startsWith('IP') || e.startsWith('SC') || e.startsWith('PM');
            return isAM && isRecent && isIPA;
        });
    }

    console.log(`Targeting ${targets.length} exams:`, targets);

    for (const examId of targets) {
        try {
            await processExam(examId, promptTemplate);
        } catch (e: any) {
            console.error(`[${examId}] Failed to process:`, e.message);
        }
    }
}

async function processExam(examId: string, promptTemplate: string) {
    const examDir = path.join(DATA_DIR, examId);
    const rawPath = path.join(examDir, 'questions_raw.json');
    const outPath = path.join(examDir, 'questions_classified.json');

    if (!fs.existsSync(rawPath)) {
        // Silent skip for missing files
        return;
    }

    // Skip if already exists (unless force)
    if (fs.existsSync(outPath) && !process.argv.includes('--force')) {
        console.log(`[${examId}] Already classified. Skipping.`);
        return;
    }

    console.log(`[${examId}] Classifying...`);
    const rawContent = fs.readFileSync(rawPath, 'utf-8');
    let questions: any[] = JSON.parse(rawContent);

    // Filter to simple list for Token Efficiency
    // We only need qNo and text.
    const simplifiedQuestions = questions.map(q => ({
        qNo: q.qNo,
        text: (q.text || "").substring(0, 300) // Truncate very long text to save tokens, usually first 300 chars is enough for classification
    }));

    const BATCH_SIZE = 20;
    let allClassified: any[] = [];
    const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        generationConfig: { responseMimeType: "application/json" }
    });

    for (let i = 0; i < simplifiedQuestions.length; i += BATCH_SIZE) {
        const batch = simplifiedQuestions.slice(i, i + BATCH_SIZE);
        console.log(`  Processing batch ${i + 1} - ${i + batch.length} / ${simplifiedQuestions.length}`);

        const prompt = `
${promptTemplate}

## Input Data
\`\`\`json
${JSON.stringify(batch, null, 2)}
\`\`\`
`;
        try {
            // Rate limit handling
            await new Promise(r => setTimeout(r, 2000));

            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Clean markdown
            let cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const batchResult = JSON.parse(jsonrepair(cleanJson));

            if (Array.isArray(batchResult)) {
                allClassified.push(...batchResult);
            } else {
                console.error("  Invalid batch result format (not array).");
            }

        } catch (e: any) {
            console.error(`  Batch failed: ${e.message}`);
            // Retry once?
        }
    }

    // Merge and Save
    // Ensure we have mappings for all
    const classificationMap = new Map(allClassified.map(c => [c.qNo, c]));

    // Create final structure (Mapping only, or full enriched?)
    // Sync-db expects to just LOAD this file and merge. 
    // Let's save just the mapping to keep files clean and separate.

    const finalOutput = questions.map(q => {
        const cls = classificationMap.get(q.qNo);
        return {
            qNo: q.qNo,
            category: cls?.category || "Unknown",
            subCategory: cls?.subCategory || "Unknown"
        };
    });

    fs.writeFileSync(outPath, JSON.stringify(finalOutput, null, 2));
    console.log(`[${examId}] Saved classification to ${outPath}`);
}

main().catch(console.error);
