
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
const possibleEnvPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
];

for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
}

const API_KEY = (process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY) as string;

if (!API_KEY) {
    console.error("GEMINI_API_KEY_2 or GEMINI_API_KEY is not defined in environment variables.");
    process.exit(1);
}

// "gemini-flash-latest" confirmed working for this key/region
const MODEL_NAME = "gemini-flash-latest";
const DATA_DIR = path.resolve(__dirname, '../../data/questions');
const PROMPT_FILE_PATH = path.resolve(__dirname, '../../prompts/transform_sc_pm.md');

// Interface for simple type checking of output
interface TransformedQuestion {
    id: string;
    context?: {
        background: string;
    };
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("Starting Batch Transformation for SC PM Exams...");
    console.log(`API Key loaded: ${API_KEY ? 'Yes (' + API_KEY.length + ' chars)' : 'No'}`);
    console.log(`Model: ${MODEL_NAME}`);

    // 1. Identify Target Exams
    const allDirs = fs.readdirSync(DATA_DIR);
    const targetDirs = allDirs.filter(d => d.match(/^SC-\d{4}-(Spring|Fall)-PM$/));

    console.log(`Found ${targetDirs.length} target exams:`, targetDirs);

    if (targetDirs.length === 0) {
        console.log("No exams found matching pattern SC-*-PM.");
        return;
    }

    // Load Prompt
    if (!fs.existsSync(PROMPT_FILE_PATH)) {
        console.error(`Prompt file not found at ${PROMPT_FILE_PATH}`);
        process.exit(1);
    }
    const promptText = fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" }
    });

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    // 2. Iterate through exams
    for (const examDirName of targetDirs) {
        console.log(`\nProcessing ${examDirName}...`);
        const examPath = path.join(DATA_DIR, examDirName);
        const rawFilePath = path.join(examPath, 'questions_raw.json');
        const outputFilePath = path.join(examPath, 'questions_transformed.json');

        // Skip if raw file doesn't exist
        if (!fs.existsSync(rawFilePath)) {
            console.log(`  [SKIP] questions_raw.json missing in ${examDirName}`);
            skipCount++;
            continue;
        }

        // Skip if output already exists (unless force)
        const force = process.argv.includes('--force');
        if (fs.existsSync(outputFilePath) && !force) {
            console.log(`  [SKIP] questions_transformed.json already exists in ${examDirName}`);
            skipCount++;
            continue;
        }

        try {
            const rawData = fs.readFileSync(rawFilePath, 'utf-8');
            let rawQuestions: any[] = JSON.parse(rawData);

            if (!Array.isArray(rawQuestions)) {
                console.log(`  [WARN] questions_raw.json structure unknown in ${examDirName} (not array)`);
                rawQuestions = [rawQuestions];
            }

            const totalInputLength = rawData.length;

            const fullPrompt = `
${promptText}

---

## Input Data (Raw JSON)

\`\`\`json
${rawData}
\`\`\`
            `;

            console.log(`  Sending request to Gemini (${MODEL_NAME})... (Input Len: ${totalInputLength})`);

            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const text = response.text();

            // Extract JSON
            let jsonStr = text;
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) jsonStr = jsonMatch[1];
            else {
                const fenceMatch = text.match(/```([\s\S]*?)```/);
                if (fenceMatch) jsonStr = fenceMatch[1];
            }
            jsonStr = jsonStr.trim();

            let parsedData: TransformedQuestion[];
            try {
                parsedData = JSON.parse(jsonStr);
            } catch (jsonErr) {
                console.error(`  [ERROR] JSON Parse Failed. Raw Response Snippet:`);
                console.log(text.substring(0, 1000));
                throw jsonErr;
            }

            // --- VALIDATION: Length Check ---
            // Calculate total context.background length in output
            let totalOutputBackgroundLength = 0;
            if (Array.isArray(parsedData)) {
                parsedData.forEach(q => {
                    if (q.context && q.context.background) {
                        totalOutputBackgroundLength += q.context.background.length;
                    }
                });
            } else {
                const q = parsedData as any;
                if (q.context && q.context.background) {
                    totalOutputBackgroundLength += q.context.background.length;
                }
            }

            let baselineTextLength = 0;
            rawQuestions.forEach((q: any) => {
                if (q.text) baselineTextLength += q.text.length;
            });

            const ratio = baselineTextLength > 0 ? (totalOutputBackgroundLength / baselineTextLength) : 0;
            console.log(`  Validation: InputQuestionTextLen=${baselineTextLength}, OutputBgLen=${totalOutputBackgroundLength}, Ratio=${ratio.toFixed(2)}`);

            if (ratio < 0.9) {
                console.warn(`  [WARN] SUSPICIOUS SUMMARIZATION DETECTED! Ratio ${ratio.toFixed(2)} is below 0.9 threshold.`);
            }

            fs.writeFileSync(outputFilePath, JSON.stringify(parsedData, null, 2), 'utf-8');
            console.log(`  [SUCCESS] Saved to ${outputFilePath}`);
            successCount++;

            // Rate Limit Safety Delay
            console.log("  Waiting 15s...");
            await delay(15000);

        } catch (e: any) {
            console.error(`  [ERROR] Failed to process ${examDirName}:`, e.message);
            fs.writeFileSync(path.join(examPath, 'transform_error.log'), `${e.message}\n\n${e.stack}`, 'utf-8');
            failCount++;
        }
    }

    console.log("\n--- Batch Transformation Complete ---");
    console.log(`Success: ${successCount}`);
    console.log(`Failed:  ${failCount}`);
    console.log(`Skipped: ${skipCount}`);
}

main().catch(console.error);
