
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

const MODEL_NAME = "gemini-pro";

const defaultExam = 'SC-2024-Fall-PM';
const examDirName = process.argv[2] || defaultExam;
const TARGET_EXAM_DIR = path.resolve(__dirname, '../../data/questions', examDirName);
const RAW_FILE_PATH = path.join(TARGET_EXAM_DIR, 'questions_raw.json');
const PROMPT_FILE_PATH = path.resolve(__dirname, '../../prompts/transform_sc_pm.md');
const OUTPUT_FILE_PATH = path.join(TARGET_EXAM_DIR, 'questions_transformed.json');

async function main() {
    console.log(`Reading Raw Data from: ${RAW_FILE_PATH}`);
    if (!fs.existsSync(RAW_FILE_PATH)) {
        console.error("Raw file not found!");
        process.exit(1);
    }
    const rawData = fs.readFileSync(RAW_FILE_PATH, 'utf-8');

    console.log(`Reading Prompt from: ${PROMPT_FILE_PATH}`);
    if (!fs.existsSync(PROMPT_FILE_PATH)) {
        console.error("Prompt file not found!");
        process.exit(1);
    }
    const promptText = fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" }
    });

    // Construct the full prompt
    const fullPrompt = `
${promptText}

---

## Input Data (Raw JSON)

\`\`\`json
${rawData}
\`\`\`
    `;

    console.log(`Sending request to Gemini Model (${MODEL_NAME})...`);

    try {
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from markdown code block if present, otherwise assume raw JSON
        let jsonStr = text;
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        } else {
            // Try stripping potential markdown fences without lang
            const fenceMatch = text.match(/```([\s\S]*?)```/);
            if (fenceMatch) jsonStr = fenceMatch[1];
        }

        // Clean up any leading/trailing whitespace
        jsonStr = jsonStr.trim();

        console.log("Parsing generated JSON...");
        // Validate JSON
        try {
            const parsed = JSON.parse(jsonStr);
            console.log("JSON is valid.");

            // Save to file
            fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
            console.log(`Success! Transformed data saved to: ${OUTPUT_FILE_PATH}`);

        } catch (e) {
            console.error("Failed to parse generated JSON:", e);
            console.log("Raw Output:", text);
            // Save raw text for debugging
            fs.writeFileSync(OUTPUT_FILE_PATH.replace('.json', '_failed.txt'), text, 'utf-8');
        }

    } catch (error: any) {
        console.error("Error during generation:", error.message);
        if (error.response) {
            console.error(error.response);
        }
    }
}

main().catch(console.error);
