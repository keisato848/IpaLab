
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

async function processExam(examDirName: string) {
    console.log(`\n========================================`);
    console.log(`Processing ${examDirName} (Rescue Mode)`);
    console.log(`========================================`);

    const examPath = path.join(DATA_DIR, examDirName);
    const rawFilePath = path.join(examPath, 'questions_raw.json');
    const outputFilePath = path.join(examPath, 'questions_transformed.json');
    const failLogPath = path.join(examPath, 'questions_transformed_rescue_failed.txt');

    if (!fs.existsSync(rawFilePath)) {
        console.error(`  [SKIP] raw file missing`);
        return;
    }

    const rawData = fs.readFileSync(rawFilePath, 'utf-8');
    const promptText = fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');
    const fullPrompt = `
${promptText}

---

## Input Data (Raw JSON)

\`\`\`json
${rawData}
\`\`\`
    `;

    const genAI = new GoogleGenerativeAI(API_KEY);

    // --- TIER 1: Flash + JsonRepair ---
    console.log(`  [Tier 1] Attempting with gemini-flash-latest...`);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        if (tryParseAndSave(text, outputFilePath)) {
            console.log(`  [SUCCESS] Tier 1 (Flash) succeeded.`);
            return;
        } else {
            console.log(`  [FAIL] Tier 1 JSON invalid even after repair.`);
        }
    } catch (e: any) {
        console.error(`  [FAIL] Tier 1 API Error: ${e.message}`);
    }

    // --- TIER 2: Pro + JsonRepair ---
    console.log(`  [Tier 2] Attempting with gemini-1.5-pro...`);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro", generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        if (tryParseAndSave(text, outputFilePath)) {
            console.log(`  [SUCCESS] Tier 2 (Pro) succeeded.`);
            return;
        } else {
            console.log(`  [FAIL] Tier 2 JSON invalid even after repair.`);
            fs.writeFileSync(failLogPath, text, 'utf-8'); // Save failing output for debug
        }
    } catch (e: any) {
        console.error(`  [FAIL] Tier 2 API Error: ${e.message}`);
    }

    console.log(`  [GAVE UP] Could not transform ${examDirName} after both tiers.`);
}

function tryParseAndSave(rawText: string, outputPath: string): boolean {
    let jsonStr = rawText;
    // Extract block if needed
    const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    else {
        const fenceMatch = rawText.match(/```([\s\S]*?)```/);
        if (fenceMatch) jsonStr = fenceMatch[1];
    }
    jsonStr = jsonStr.trim();

    try {
        // 1. Try Native Parse
        JSON.parse(jsonStr);
        fs.writeFileSync(outputPath, jsonStr, 'utf-8'); // Save Original Clean JSON
        return true;
    } catch (e) {
        console.log(`    Native JSON parse failed, trying jsonrepair...`);
        try {
            // 2. Try Repair
            const repaired = jsonrepair(jsonStr);
            const parsed = JSON.parse(repaired); // Check validity
            fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2), 'utf-8');
            console.log(`    Repaired successfully!`);
            return true;
        } catch (repErr) {
            console.error(`    Repair failed: ${(repErr as Error).message}`);
            return false;
        }
    }
}

async function main() {
    for (const exam of TARGET_EXAMS) {
        await processExam(exam);
    }
}

main();
