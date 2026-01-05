
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { jsonrepair } from 'jsonrepair';

// Load env
const envPath = path.resolve(__dirname, '../../../../apps/web/.env.local');
dotenv.config({ path: envPath });

const API_KEY = (process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY) as string;

if (!API_KEY) {
    console.error("No API Key found");
    process.exit(1);
}

const DATA_DIR = path.resolve(__dirname, '../../data/questions');
const PROMPT_FILE_PATH = path.resolve(__dirname, '../../prompts/transform_sc_pm.md');

// Target strictly the failed exams
const TARGET_EXAMS = ['SC-2023-Fall-PM', 'SC-2025-Fall-PM'];

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function transformSingleQuestion(genAI: GoogleGenerativeAI, questionRaw: any, promptTemplate: string): Promise<any> {
    const qNo = questionRaw.qNo || '?';
    console.log(`    Processing Q${qNo}...`);

    // Create a specific prompt for this single question
    const fullPrompt = `
${promptTemplate}

---

## Input Data (Single Question Raw JSON)

\`\`\`json
${JSON.stringify([questionRaw], null, 2)}
\`\`\`

IMPORTANT: Output MUST be a valid JSON array containing exactly ONE transformed question object.
    `;

    // Strategy: Flash First -> Repair -> Pro Second -> Repair
    // Tier 1: Flash
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();
        const parsed = tryParse(text);
        if (parsed) {
            console.log(`      [Success] Flash`);
            return parsed[0]; // Expecting Array
        }
    } catch (e: any) {
        console.warn(`      [Warn] Flash failed: ${e.message}`);
    }

    // Tier 2: Pro (Fallback)
    try {
        console.log(`      [Fallback] Trying gemini-pro...`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro", generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();
        const parsed = tryParse(text);
        if (parsed) {
            console.log(`      [Success] Pro`);
            return parsed[0];
        }
    } catch (e: any) {
        console.error(`      [Error] Pro failed: ${e.message}`);
    }

    throw new Error(`Failed to transform Q${qNo} after all attempts.`);
}

function tryParse(rawText: string): any | null {
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    else {
        const fenceMatch = rawText.match(/```([\s\S]*?)```/);
        if (fenceMatch) jsonStr = fenceMatch[1];
    }
    jsonStr = jsonStr.trim();

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        try {
            const repaired = jsonrepair(jsonStr);
            return JSON.parse(repaired);
        } catch (repErr) {
            return null;
        }
    }
}

async function processExam(examDirName: string) {
    console.log(`\n========================================`);
    console.log(`Final Fix: ${examDirName}`);
    console.log(`========================================`);

    const examPath = path.join(DATA_DIR, examDirName);
    const rawFilePath = path.join(examPath, 'questions_raw.json');
    const outputFilePath = path.join(examPath, 'questions_transformed.json');

    if (!fs.existsSync(rawFilePath)) {
        console.error(`  [SKIP] raw file missing`);
        return;
    }

    const rawData = fs.readFileSync(rawFilePath, 'utf-8');
    let rawQuestions: any[] = JSON.parse(rawData);

    // Normalize input
    if (rawQuestions && !Array.isArray(rawQuestions) && (rawQuestions as any).questions) {
        rawQuestions = (rawQuestions as any).questions;
    }

    if (!Array.isArray(rawQuestions)) {
        console.error(`  [ERROR] Input is not an array or {questions: []}`);
        return;
    }

    const promptText = fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');
    const genAI = new GoogleGenerativeAI(API_KEY);
    const transformedQuestions: any[] = [];
    let failure = false;

    for (const q of rawQuestions) {
        try {
            const transformed = await transformSingleQuestion(genAI, q, promptText);
            transformedQuestions.push(transformed);
            // Rate limit buffer
            await delay(2000);
        } catch (e) {
            console.error(`  [FATAL] Could not transform Q${q.qNo || '?'}. Skipping exam save.`);
            failure = true;
            break;
        }
    }

    if (!failure) {
        fs.writeFileSync(outputFilePath, JSON.stringify(transformedQuestions, null, 2), 'utf-8');
        console.log(`  [COMPLETE] Saved ${transformedQuestions.length} questions to ${outputFilePath}`);
    } else {
        console.log(`  [ABORT] Exam processing failed.`);
    }
}

async function main() {
    for (const exam of TARGET_EXAMS) {
        await processExam(exam);
    }
}

main();
