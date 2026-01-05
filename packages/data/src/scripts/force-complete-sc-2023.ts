
import { GoogleGenAI } from "@google/genai";
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

// Target strictly SC-2023
const TARGET_EXAM = 'SC-2023-Fall-PM';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function transformSingleQuestionV1(client: any, questionRaw: any, promptTemplate: string): Promise<any> {
    const qNo = questionRaw.qNo || '?';
    console.log(`    Processing Q${qNo} with Gemini 3 Pro (v1 SDK)...`);

    const fullPrompt = `
${promptTemplate}

---

## Input Data (Single Question Raw JSON)

\`\`\`json
${JSON.stringify([questionRaw], null, 2)}
\`\`\`

IMPORTANT: Output MUST be a valid JSON array containing exactly ONE transformed question object.
    `;

    // Try Gemini 3 Pro Preview
    const modelName = "gemini-3-pro-preview";

    try {
        console.log(`      [Attempt] Model: ${modelName} (SDK: @google/genai)`);

        // Note: The new SDK syntax is ai.models.generateContent
        const response = await client.models.generateContent({
            model: modelName,
            contents: fullPrompt,
            config: {
                // Assuming newer SDK supports JSON mime type or prompt instruction is enough
                // V1 SDK often uses responseMimeType in config
                responseMimeType: "application/json"
            }
        });

        // V1 SDK often returns text as a property, not a function
        const text = response.text;

        // Validate JSON
        const parsed = tryParse(text);
        if (parsed) {
            console.log(`      [Success] Model ${modelName} succeeded.`);
            return parsed[0];
        } else {
            console.warn(`      [Warn] Model ${modelName} returned invalid JSON.`);
            console.warn(`        Output start: ${text ? text.substring(0, 100) : "NULL"}`);
        }
    } catch (e: any) {
        console.warn(`      [Warn] Model ${modelName} failed: ${e.message}`);
    }

    throw new Error(`Failed to transform Q${qNo} with Gemini 3 Pro.`);
}

function tryParse(rawText: string | null | undefined): any | null {
    if (!rawText) return null;
    let jsonStr = rawText;

    // 1. Try extracting from markdown block
    const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    else {
        // 2. Try extracting from generic code block
        const fenceMatch = rawText.match(/```([\s\S]*?)```/);
        if (fenceMatch) jsonStr = fenceMatch[1];
    }

    // 3. Fallback: If no blocks, but starts with [, assume it's raw JSON
    jsonStr = jsonStr.trim();

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        // 4. Try jsonrepair
        try {
            const repaired = jsonrepair(jsonStr);
            return JSON.parse(repaired);
        } catch (repErr) {
            // 5. Last ditch: Extract outermost array [ ... ]
            try {
                const arrayMatch = jsonStr.match(/\[([\s\S]*)\]/);
                if (arrayMatch) {
                    const innerRepaired = jsonrepair(arrayMatch[0]);
                    return JSON.parse(innerRepaired);
                }
            } catch (innerErr) { }

            return null;
        }
    }
}

async function main() {
    console.log(`\n========================================`);
    console.log(`Force Complete: ${TARGET_EXAM} (@google/genai SDK)`);
    console.log(`========================================`);

    const examPath = path.join(DATA_DIR, TARGET_EXAM);
    const rawFilePath = path.join(examPath, 'questions_raw.json');
    const outputFilePath = path.join(examPath, 'questions_transformed.json');

    if (!fs.existsSync(rawFilePath)) {
        console.error(`  [SKIP] raw file missing`);
        return;
    }

    const rawData = fs.readFileSync(rawFilePath, 'utf-8');
    let rawQuestions: any[] = JSON.parse(rawData);

    if (rawQuestions && !Array.isArray(rawQuestions) && (rawQuestions as any).questions) {
        rawQuestions = (rawQuestions as any).questions;
    }

    const promptText = fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');

    // Initialize New SDK
    // Based on user snippet: const ai = new GoogleGenAI({});
    // We assume it reads API key from env or we pass it. 
    // Usually { apiKey: ... } is safest.
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const transformedQuestions: any[] = [];
    let failure = false;

    // Process sequentially
    for (const q of rawQuestions) {
        try {
            const transformed = await transformSingleQuestionV1(ai, q, promptText);
            transformedQuestions.push(transformed);
            // Rate limit buffer
            await delay(5000);
        } catch (e) {
            console.error(`  [FATAL] Could not transform Q${q.qNo || '?'}. Aborting.`);
            failure = true;
            break;
        }
    }

    if (!failure && transformedQuestions.length > 0) {
        fs.writeFileSync(outputFilePath, JSON.stringify(transformedQuestions, null, 2), 'utf-8');
        console.log(`  [COMPLETE] Saved ${transformedQuestions.length} questions to ${outputFilePath}`);
    } else {
        console.log(`  [ABORT] Exam processing failed.`);
    }
}

main();
