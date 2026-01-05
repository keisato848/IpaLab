
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
const TARGET_EXAM = 'SC-2023-Fall-PM';
// Returning to Preview model as it is the only one accessible with current SDK setup (no 404)
const MODEL_NAME = "gemini-3-pro-preview";

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function extractBackgroundText(client: GoogleGenAI, questionRaw: any): Promise<string> {
    console.log(`    [Atomic Step 1A] Extracting Background (Plain Text)...`);
    const prompt = `
Goal: Extract the "Background Text" (Case Study) from the input.
Return ONLY the raw text. Do not wrap in JSON. Do not include diagrams code (leave placeholders like {{diagram:fig1}} if possible, or just text).
Do not include questions.

## INPUT
\`\`\`json
${JSON.stringify(questionRaw)}
\`\`\`
`;
    // Text extraction is usually robust
    const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
    });
    const text = response.text;
    if (!text) throw new Error("No text returned for Background");
    return text.trim();
}

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
    try {
        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const parsed = tryParse(response.text);
        if (!parsed) return [];
        return Array.isArray(parsed) ? parsed : (parsed.diagrams || []);
    } catch (e) {
        console.warn(`      [Graceful Degradation] Diagram extraction failed. Proceeding with empty diagrams.`);
        return [];
    }
}

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
    try {
        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const parsed = tryParse(response.text);
        if (parsed && Array.isArray(parsed)) {
            console.log(`      Found labels: ${JSON.stringify(parsed)}`);
            return parsed;
        }
    } catch (e) { }

    // Fallback if model fails: Hardcoded for SC PM typically
    console.warn(`      [Graceful Degradation] Label identification failed. Using default sequence.`);
    return ["設問1", "設問2", "設問3", "設問4"];
}

async function extractSubQuestion(client: GoogleGenAI, questionRaw: any, baseSchema: string, label: string): Promise<any | null> {
    console.log(`    [Atomic Step 3] Extracting ${label}...`);
    const prompt = `
You are a data extraction engine.
Goal: Extract ONLY the data for the specific sub-question: "${label}".
${baseSchema}
## INSTRUCTIONS
1. Find the section for "${label}" in the input.
2. Extract it as a single \`SubQuestion\` object. 
3. If "${label}" does not exist in the input, return null.
## INPUT
\`\`\`json
${JSON.stringify(questionRaw)}
\`\`\`
`;
    try {
        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return tryParse(response.text);
    } catch (e) {
        console.warn(`      [Graceful Degradation] Failed to extract ${label}: ${e}`);
        return null;
    }
}

async function main() {
    console.log(`\n========================================`);
    console.log(`Fix SC-2023 Q1 (Graceful Degradation): ${TARGET_EXAM}`);
    console.log(`========================================`);

    const examPath = path.join(DATA_DIR, TARGET_EXAM);
    const rawFilePath = path.join(examPath, 'questions_raw.json');
    const outputFilePath = path.join(examPath, 'questions_transformed.json');

    // Load Transformed (Q2, Q3)
    let finalQuestions: any[] = [];
    if (fs.existsSync(outputFilePath)) {
        finalQuestions = JSON.parse(fs.readFileSync(outputFilePath, 'utf-8'));
    }

    const rawData = fs.readFileSync(rawFilePath, 'utf-8');
    let rawQuestions: any[] = JSON.parse(rawData);
    if (rawQuestions && !Array.isArray(rawQuestions) && (rawQuestions as any).questions) {
        rawQuestions = (rawQuestions as any).questions;
    }

    // Target Q1 only
    const q1Raw = rawQuestions.find((q: any) => q.qNo === 1 || q.qNo === '1');
    if (!q1Raw) {
        console.error("Q1 not found in raw data.");
        return;
    }

    // Remove old Q1 if exists (it shouldn't, but safety first)
    finalQuestions = finalQuestions.filter(q => q.qNo !== 1);

    const basePrompt = fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');
    const client = new GoogleGenAI({ apiKey: API_KEY });

    console.log(`\nProcessing Q1 (Graceful Mode)...`);
    try {
        // 1A. Background (Must Succeed)
        const backgroundText = await extractBackgroundText(client, q1Raw);

        // 1B. Diagrams (Can Fail)
        const diagrams = await extractDiagrams(client, q1Raw, basePrompt);

        const contextData = {
            title: q1Raw.theme || "Web App Security",
            background: backgroundText,
            diagrams: diagrams
        };

        // 2. Labels (Can Fail -> Fallback)
        let labels = await identifySubQuestions(client, q1Raw);

        // 3. SubQuestions
        const extractedSubQuestions: any[] = [];
        for (const label of labels) {
            await delay(2000);
            const sq = await extractSubQuestion(client, q1Raw, basePrompt, label);
            if (sq) {
                if (!sq.subQNo) {
                    if (sq.questions && sq.questions[0]) extractedSubQuestions.push(sq.questions[0]);
                    else sq.subQNo = label;
                }
                const item = Array.isArray(sq) ? sq[0] : sq;
                extractedSubQuestions.push(item);
            }
        }

        const finalQ1 = {
            qNo: 1,
            theme: q1Raw.theme || "Unknown Theme",
            description: q1Raw.description || "",
            context: contextData,
            questions: extractedSubQuestions
        };

        // Prepend Q1
        finalQuestions.unshift(finalQ1);
        finalQuestions.sort((a, b) => a.qNo - b.qNo);

        fs.writeFileSync(outputFilePath, JSON.stringify(finalQuestions, null, 2), 'utf-8');
        console.log(`  [COMPLETE] Saved ${finalQuestions.length} questions (Q1 added) to ${outputFilePath}`);

    } catch (e: any) {
        console.error(`  [FATAL] Q1 Fix Failed: ${e.message}`);
    }
}

main();
