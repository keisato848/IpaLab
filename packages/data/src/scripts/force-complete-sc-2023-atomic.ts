
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
// We will build custom prompts in the script for atomic operations, referencing the base prompt's schema
const PROMPT_FILE_PATH = path.resolve(__dirname, '../../prompts/transform_sc_pm.md');
const TARGET_EXAM = 'SC-2023-Fall-PM';
const MODEL_NAME = "gemini-3-pro-preview";

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to parse JSON
function tryParse(rawText: string | null | undefined): any | null {
    if (!rawText) return null;
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
            try {
                const arrayMatch = jsonStr.match(/\[([\s\S]*)\]/);
                if (arrayMatch) {
                    const innerRepaired = jsonrepair(arrayMatch[0]);
                    return JSON.parse(innerRepaired);
                }
            } catch (innerErr) { }
            // Try matching object
            try {
                const objMatch = jsonStr.match(/\{([\s\S]*)\}/);
                if (objMatch) {
                    const innerRepaired = jsonrepair(objMatch[0]);
                    return JSON.parse(innerRepaired);
                }
            } catch (objErr) { }

            return null;
        }
    }
}

// ---------------------------------------------------------
// ATOMIC STEP 1A: Extract Background Text (Plain Text)
// ---------------------------------------------------------
async function extractBackgroundText(client: GoogleGenAI, questionRaw: any): Promise<string> {
    console.log(`    [Atomic Step 1A] Extracting Background (Plain Text)...`);

    // We pass the raw question but instruct strictly to return text
    const prompt = `
Goal: Extract the "Background Text" (Case Study) from the input.
Return ONLY the raw text. Do not wrap in JSON. Do not include diagrams code (leave placeholders like {{diagram:fig1}} if possible, or just text).
Do not include questions.

## INPUT
\`\`\`json
${JSON.stringify(questionRaw)}
\`\`\`
`;

    const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            // responseMimeType: "text/plain" // Default is text
        }
    });

    const text = response.text;
    if (!text) throw new Error("No text returned for Background");
    return text.trim();
}

// ---------------------------------------------------------
// ATOMIC STEP 1B: Extract Diagrams (JSON)
// ---------------------------------------------------------
async function extractDiagrams(client: GoogleGenAI, questionRaw: any, baseSchema: string): Promise<any[]> {
    console.log(`    [Atomic Step 1B] Extracting Diagrams (JSON)...`);

    const prompt = `
Goal: Extract "Diagrams" (definitions for mermaid or tables) from the input.
Use the schema definition for \`Diagram[]\`.

${baseSchema}

## INSTRUCTIONS
1. Analyze the input.
2. Extract all diagrams into a JSON Array of \`Diagram\`.
3. Return ONLY valid JSON array.

## INPUT
\`\`\`json
${JSON.stringify(questionRaw)}
\`\`\`
`;

    const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    const parsed = tryParse(response.text);
    if (!parsed) {
        console.warn("    [WARN] Failed to parse Diagrams JSON. Returning empty array.");
        console.warn(response.text ? response.text.substring(0, 200) : "NULL");
        return []; // Non-critical? Text is more important.
    }
    return Array.isArray(parsed) ? parsed : (parsed.diagrams || []);
}


// ---------------------------------------------------------
// ATOMIC STEP 1.5: Identify Sub-Question Labels
// ---------------------------------------------------------
async function identifySubQuestions(client: GoogleGenAI, questionRaw: any): Promise<string[]> {
    console.log(`    [Atomic Step 2] Identifying Sub-Question Labels...`);

    const prompt = `
Analyze the input text and list the labels of all "Sub-Questions" (e.g. "設問1", "設問2").
Return ONLY a JSON string array. Example: ["設問1", "設問2", "設問3"]

## INPUT
\`\`\`json
${JSON.stringify(questionRaw)}
\`\`\`
`;

    const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    const parsed = tryParse(response.text);
    if (!parsed || !Array.isArray(parsed)) throw new Error("Failed to parse SubQuestion Labels");
    console.log(`      Found labels: ${JSON.stringify(parsed)}`);
    return parsed;
}

// ---------------------------------------------------------
// ATOMIC STEP 2: Extract Single Sub-Question
// ---------------------------------------------------------
async function extractSubQuestion(client: GoogleGenAI, questionRaw: any, baseSchema: string, label: string): Promise<any> {
    console.log(`    [Atomic Step 3] Extracting ${label}...`);

    const prompt = `
You are a data extraction engine.
Goal: Extract ONLY the data for the specific sub-question: "${label}".

${baseSchema}

## INSTRUCTIONS
1. Find the section for "${label}" in the input.
2. Extract it as a single \`SubQuestion\` object (see schema).
3. Do NOT extract context or other sub-questions.
4. Return ONLY the JSON object for this SubQuestion.

## INPUT
\`\`\`json
${JSON.stringify(questionRaw)}
\`\`\`
`;

    const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    const parsed = tryParse(response.text);
    if (!parsed) throw new Error(`Failed to parse JSON for ${label}`);
    return parsed;
}


// ---------------------------------------------------------
// MAIN
// ---------------------------------------------------------
async function main() {
    console.log(`\n========================================`);
    console.log(`Force Complete Atomic (Refined): ${TARGET_EXAM}`);
    console.log(`========================================`);

    const examPath = path.join(DATA_DIR, TARGET_EXAM);
    const rawFilePath = path.join(examPath, 'questions_raw.json');
    const outputFilePath = path.join(examPath, 'questions_transformed.json');

    const rawData = fs.readFileSync(rawFilePath, 'utf-8');
    let rawQuestions: any[] = JSON.parse(rawData);
    if (rawQuestions && !Array.isArray(rawQuestions) && (rawQuestions as any).questions) {
        rawQuestions = (rawQuestions as any).questions;
    }

    // Read Schema from prompt file but just use it as reference in prompt
    const basePrompt = fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');

    const client = new GoogleGenAI({ apiKey: API_KEY });
    const finalQuestions: any[] = [];

    let qIdx = 1;
    for (const rawQ of rawQuestions) {
        console.log(`\nProcessing Raw Question ${qIdx}...`);
        try {
            // 1A. Get Background Text (Plain)
            const backgroundText = await extractBackgroundText(client, rawQ);

            // 1B. Get Diagrams (JSON)
            const diagrams = await extractDiagrams(client, rawQ, basePrompt);

            const contextData = {
                title: rawQ.theme || "Extracted Title", // Hack: use theme or ask AI
                background: backgroundText,
                diagrams: diagrams
            };

            // 2. Identify Labels
            const labels = await identifySubQuestions(client, rawQ);

            // 3. Loop Labels
            const extractedSubQuestions: any[] = [];
            for (const label of labels) {
                await delay(2000); // Rate limit
                try {
                    const sq = await extractSubQuestion(client, rawQ, basePrompt, label);

                    // Ensure correct structure
                    if (!sq.subQNo) {
                        if (sq.questions && sq.questions[0]) extractedSubQuestions.push(sq.questions[0]);
                        else sq.subQNo = label; // Patch
                    }

                    const item = Array.isArray(sq) ? sq[0] : sq;
                    extractedSubQuestions.push(item);
                } catch (sqError: any) {
                    console.error(`      [Error] Failed to extract ${label}: ${sqError.message}`);
                    // Continue to next subquestion
                }
            }

            // 4. Merge
            const finalQ = {
                qNo: rawQ.qNo || qIdx,
                theme: rawQ.theme || "Unknown Theme",
                description: rawQ.description || "",
                context: contextData,
                questions: extractedSubQuestions
            };

            finalQuestions.push(finalQ);

        } catch (e: any) {
            console.error(`  [FATAL] Failed to process Q${qIdx}: ${e.message}`);
            // Don't abort, try next big question if any (SC PM usually has 2 selectable, here raw might have more?)
        }
        qIdx++;
    }

    // Save
    if (finalQuestions.length > 0) {
        fs.writeFileSync(outputFilePath, JSON.stringify(finalQuestions, null, 2), 'utf-8');
        console.log(`  [COMPLETE] Saved ${finalQuestions.length} questions to ${outputFilePath}`);
    } else {
        console.log("  [FAILURE] No questions transformed.");
    }
}

main();
