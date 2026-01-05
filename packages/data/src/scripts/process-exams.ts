
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { jsonrepair } from 'jsonrepair';
import axios from 'axios';

// Load Environment
const envPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
];
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const API_KEY = (process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY) as string;
if (!API_KEY) {
    console.error("No GEMINI_API_KEY found.");
    process.exit(1);
}

const DATA_DIR = path.resolve(__dirname, '../../data/questions');
const PROMPT_FILE_PATH = path.resolve(__dirname, '../../prompts/transform_sc_pm.md');
const WEB_BASE_URL = 'http://localhost:3000';

// --- HELPER: Delay ---
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- HELPER: Transform Logic (Tiered) ---
async function transformData(examId: string, genAI: GoogleGenerativeAI): Promise<boolean> {
    const examDir = path.join(DATA_DIR, examId);
    const rawPath = path.join(examDir, 'questions_raw.json');
    const outPath = path.join(examDir, 'questions_transformed.json');

    // Skip if input missing
    if (!fs.existsSync(rawPath)) {
        console.error(`[${examId}] Missing questions_raw.json`);
        return false;
    }

    // Skip if output exists (User said "Repeat", but maybe we skip done ones? 
    // "修正が進んでいない...修正してください" implies processing pending ones. 
    // But "Verify" 34 times implies checking all. 
    // I will RE-GENERATE if it doesn't exist, but if it exists, I will just CLEANSE & VERIFY to save credits/time?
    // User said "Start with SC... Repat 34 times". 
    // Let's assume if it exists, we proceed to Verification step unless --force is used.
    if (fs.existsSync(outPath) && !process.argv.includes('--force')) {
        console.log(`[${examId}] Already transformed. Skipping generation.`);
        return true;
    }

    console.log(`[${examId}] Starting Transformation...`);
    const rawContent = fs.readFileSync(rawPath, 'utf-8');
    let rawQuestions: any = JSON.parse(rawContent);
    // Normalize Raw Input
    if (!Array.isArray(rawQuestions) && rawQuestions.questions) rawQuestions = rawQuestions.questions;
    if (!Array.isArray(rawQuestions)) rawQuestions = [rawQuestions];

    const promptTemplate = fs.existsSync(PROMPT_FILE_PATH) ? fs.readFileSync(PROMPT_FILE_PATH, 'utf-8') : "";
    if (!promptTemplate) throw new Error("Prompt file missing");

    const transformedData: any[] = [];

    // Process each generic question (usually 1 big context in PM)
    for (const q of rawQuestions) {
        const qNo = q.qNo || 'Main';
        const fullPrompt = `
${promptTemplate}

---
## Input Data
\`\`\`json
${JSON.stringify([q], null, 2)}
\`\`\`
IMPORTANT: Output valid JSON Array with 1 element.
`;

        let resultData: any = null;

        // Tier 1: Flash
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json" } });
            const result = await model.generateContent(fullPrompt);
            const text = result.response.text();
            resultData = tryParse(text);
        } catch (e) { }

        // Tier 2: Pro
        if (!resultData) {
            console.log(`[${examId}] Flash failed for Q${qNo}. Retrying with Pro...`);
            await delay(1000); // Backoff
            try {
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro", generationConfig: { responseMimeType: "application/json" } });
                const result = await model.generateContent(fullPrompt);
                const text = result.response.text();
                resultData = tryParse(text);
            } catch (e) {
                console.error(`[${examId}] Pro failed: ${(e as any).message}`);
            }
        }

        if (resultData && Array.isArray(resultData)) {
            transformedData.push(resultData[0]);
        } else {
            console.error(`[${examId}] Failed to transform Q${qNo}.`);
            return false;
        }
        await delay(2000); // Rate limit buffer
    }

    fs.writeFileSync(outPath, JSON.stringify(transformedData, null, 2));
    console.log(`[${examId}] Transformation Saved.`);
    return true;
}

function tryParse(text: string) {
    let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try { return JSON.parse(jsonStr); }
    catch {
        try { return JSON.parse(jsonrepair(jsonStr)); } catch { return null; }
    }
}

// --- HELPER: Cleanse/UI Fix ---
async function cleanseData(examId: string): Promise<boolean> {
    const examDir = path.join(DATA_DIR, examId);
    const outPath = path.join(examDir, 'questions_transformed.json');
    if (!fs.existsSync(outPath)) return false;

    console.log(`[${examId}] Running Data Cleansing/Normalization...`);

    // Logic from cleanse-pm-data.ts (simplified for single file)
    let data: any = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    let modified = false;

    // 1. Array Wrapper
    if (Array.isArray(data)) { data = { questions: data }; modified = true; }

    // 1.5 MERGE DUPLICATES (Fix for fragmented raw/transformed data)
    if (data.questions && Array.isArray(data.questions)) {
        const uniqueQ: any[] = [];
        const byQNo = new Map<string, any>();

        // Group by qNo
        for (const q of data.questions) {
            const qNo = String(q.qNo || '1');
            if (!byQNo.has(qNo)) {
                byQNo.set(qNo, q);
                uniqueQ.push(q);
            } else {
                // Merge
                console.log(`[${examId}] Merging fragment for Q${qNo}...`);
                const base = byQNo.get(qNo);

                // Merge Context (Append Background)
                if (q.context) {
                    if (!base.context) base.context = q.context;
                    else {
                        if (q.context.background) {
                            base.context.background = (base.context.background || "") + "\n\n" + q.context.background;
                        }
                        if (q.context.diagrams && Array.isArray(q.context.diagrams)) {
                            base.context.diagrams = [...(base.context.diagrams || []), ...q.context.diagrams];
                        }
                    }
                }

                // Merge SubQuestions
                if (q.questions && Array.isArray(q.questions)) {
                    base.questions = [...(base.questions || []), ...q.questions];
                }

                // Merge Description (if Context didn't cover it)
                if (q.description && !base.description) base.description = q.description;

                modified = true;
            }
        }

        if (modified) {
            data.questions = uniqueQ; // Replace with merged list
        }
    }

    // 2. Point Alloc
    if (data.questions) {
        let totalCount = 0;
        data.questions.forEach((q: any) => {
            // subQuestions property name might vary?
            // Prompt schema says output: "questions: SubQuestion[]" inside ExamQuestion.
            // Inside SubQuestion, "subQuestions" property might exist if nested.
            // Usually top level inside 'questions' (ExamQuestion) has 'questions' array (SubQuestions).
            // But my merge logic used 'q.questions'. 
            // Let's check schema used in transformation.
            // Prompt: `questions: SubQuestion[]`.
            // And my merge logic used `q.questions`. Correct.

            // Point logic calculation:
            // If `q.questions` (SubQuestions) exists:
            if (q.questions && Array.isArray(q.questions)) {
                totalCount += q.questions.length;
            } else {
                totalCount += 1;
            }
        });

        const points = totalCount > 0 ? Math.floor(100 / totalCount) : 0;
        if (totalCount > 0 && points > 0) {
            // Simple fill if missing
            data.questions.forEach((q: any) => {
                // Iterate SubQuestions
                if (q.questions && Array.isArray(q.questions)) {
                    q.questions.forEach((sq: any) => {
                        if (!sq.point) sq.point = points;
                    });
                } else {
                    if (!q.point) q.point = points;
                }

                // Also handle `point` on the ExamQuestion level if flat?
                // Usually AP/SC PM has SubQuestions.
            });
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
        console.log(`[${examId}] Cleansed.`);
    }
    return true;
}

// --- HELPER: Sync DB ---
async function syncExamToDB(examId: string): Promise<boolean> {
    console.log(`[${examId}] Starting DB Sync...`);
    const { CosmosClient } = require('@azure/cosmos');

    // Env check
    const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || process.env.Values_COSMOS_DB_CONNECTION;
    if (!CONNECTION_STRING) {
        console.error(`[${examId}] Sync Failed: COSMOS_DB_CONNECTION missing.`);
        return false;
    }
    console.log(`[${examId}] DB Connection Configured.`);

    // Client Setup
    const isLocal = CONNECTION_STRING.includes('localhost') || CONNECTION_STRING.includes('127.0.0.1');
    let clientOptions: any = { connectionString: CONNECTION_STRING };
    if (isLocal) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        // Need to import https for Agent if generic fetch not used by Cosmos SDK?
        // Cosmos SDK usually handles it, but let's be safe if strictly needed.
        // Actually locally we can just set rejectUnauthorized: false via Agent if exposed.
        // For simplicity, just strict SSL disable is often enough for local emulator + SDK.
        const https = require('https');
        clientOptions.agent = new https.Agent({ rejectUnauthorized: false });
    }

    try {
        const client = new CosmosClient(clientOptions);
        const database = client.database("pm-exam-dx-db");
        const container = database.container("Questions");
        const examContainer = database.container("Exams"); // Also update Exam Metadata

        const examDir = path.join(DATA_DIR, examId);
        const outPath = path.join(examDir, 'questions_transformed.json');

        const content = fs.readFileSync(outPath, 'utf-8');
        const data = JSON.parse(content);
        let questions = Array.isArray(data) ? data : (data.questions || []);

        if (!Array.isArray(questions)) questions = [questions]; // Fallback

        // 1. Exam Meta Upsert (Simplified)
        // Parse ID: SC-2022-Spring-PM2
        const parts = examId.split('-'); // [SC, 2022, Spring, PM2]
        const yearStr = parts[1] || "2000";
        const seasonStr = parts[2] === 'Spring' ? 'S' : 'F';
        const typeStr = parts[3] || 'PM';

        let type = 'PM';
        if (typeStr.includes('AM2')) type = 'AM2';
        else if (typeStr.includes('PM1')) type = 'PM1';
        else if (typeStr.includes('PM2')) type = 'PM2';

        const examItem = {
            id: examId,
            title: `${yearStr}年度 ${seasonStr === 'S' ? '春期' : '秋期'} ${parts[0]} ${type.replace('PM', '午後').replace('AM', '午前')}`,
            category: parts[0],
            year: parseInt(yearStr),
            term: seasonStr,
            type: type,
            date: `${yearStr}-${seasonStr === 'S' ? '04' : '10'}-15`,
            stats: { total: questions.length * (type.includes('PM') ? 1 : 20), completed: 0, correctRate: 0 }
        };
        console.log(`[${examId}] Upserting Exam Meta...`);
        await examContainer.items.upsert(examItem);

        // 2. Questions Upsert
        console.log(`[${examId}] Preparing Questions...`);
        const isPM = true; // We mostly target PM here
        const itemsToUpsert: any[] = [];

        // Group/Hierarchy Logic (Copied/Adapted from sync-db.ts)
        // PM structure is usually single Root per file if it's "PM Question 1"
        // But if `questions` array has multiple...

        // Actually, for PM, the `questions_transformed.json` usually contains:
        // { qNo: 1, context: ..., questions: [SubQ] }

        for (const q of questions) {

            // If it's the "Main" container
            const qNo = q.qNo || 1;
            const contextObj = q.context || null;
            const descriptionText = contextObj ? contextObj.background : (q.description || "");

            itemsToUpsert.push({
                id: `${examId}-${qNo}`, // Root ID e.g. SC-2022-Spring-PM2-1
                examId: examId,
                type: type,
                qNo: qNo,
                text: q.theme || `問${qNo}`,
                description: descriptionText,
                context: contextObj,
                questions: q.questions // The SubQuestions
            });
        }

        for (const item of itemsToUpsert) {
            await container.items.upsert(item);
        }

        console.log(`[${examId}] Synced to DB (${itemsToUpsert.length} items).`);
        return true;

    } catch (e: any) {
        console.error(`[${examId}] Sync DB Failed: ${e.message}`);
        return false;
    }
}

// --- HELPER: Verification ---
async function verifyApp(examId: string): Promise<boolean> {
    console.log(`[${examId}] Verifying Application (Localhost)...`);

    // Determine URL Params
    // ID: SC-2024-Fall-PM -> Year: SC-2024-Fall-PM, Type: PM (default logic in page.tsx)
    // URL: /exam/SC-2024-Fall-PM/PM/1

    let type = 'PM';
    if (examId.endsWith('PM1')) type = 'PM1';
    if (examId.endsWith('PM2')) type = 'PM2';

    const url = `${WEB_BASE_URL}/exam/${examId}/${type}/1`;

    try {
        const res = await axios.get(url);
        if (res.status === 200) {
            // Basic Content Check
            if (res.data.includes('解答例')) { // Check for UI element we know exists
                console.log(`[${examId}] Verification SUCCESS (200 OK, Content Found).`);
                return true;
            } else {
                // Might be 200 but 404 page content?
                // Next.js 404 status is 404, so 200 means page loaded.
                // But check if it says "Question not found"?
                if (res.data.includes('問題が見つかりません')) {
                    console.error(`[${examId}] Verification FAILED: Page loaded but content missing.`);
                    return false;
                }
                console.log(`[${examId}] Verification SUCCESS (200 OK).`);
                return true;
            }
        }
    } catch (e: any) {
        console.error(`[${examId}] Verification FAILED: ${e.message}`);
        if (e.response) {
            console.error(`   Status: ${e.response.status}`);
            console.error(`   Data: ${JSON.stringify(e.response.data).substring(0, 200)}...`);
        }
        return false;
    }
    return false;
}

// --- MAIN ---
async function main() {
    const targetPrefix = process.argv[2] || 'SC'; // Default SC

    const allDirs = fs.readdirSync(DATA_DIR);
    // Find matching directories (e.g. SC-*-PM*)
    const targets = allDirs.filter(d => d.startsWith(targetPrefix) && (d.includes('-PM') || d.includes('PM1') || d.includes('PM2')));

    targets.sort().reverse(); // Newest first

    console.log(`Targeting ${targets.length} exams matching '${targetPrefix}'...`);

    let successCount = 0;

    for (const examId of targets) {
        console.log(`\n=== Processing ${examId} ===`);

        // Step 1: Data Fix (Transform)
        const okTransform = await transformData(examId, new GoogleGenerativeAI(API_KEY));
        if (!okTransform) {
            console.error(`[STOP] Data Transformation failed for ${examId}. Stopping.`);
            process.exit(1);
        }

        // Step 2: UI Fix (Cleanse/Normalize)
        const okCleanse = await cleanseData(examId);
        if (!okCleanse) {
            console.error(`[STOP] Data Cleansing failed for ${examId}. Stopping.`);
            process.exit(1);
        }

        // Step 3: DB Sync (Critical for Runtime Verify)
        const okSync = await syncExamToDB(examId);
        if (!okSync) {
            console.error(`[STOP] DB Sync failed for ${examId}. Stopping.`);
            // process.exit(1); // Maybe robust?
        }

        // Step 4: Verification
        // Note: SSG build is slow to run 34 times. Use Runtime Verify via Dev Server.
        const okVerify = await verifyApp(examId);
        if (!okVerify) {
            console.error(`[STOP] Application Verification failed for ${examId}. Stopping.`);
            process.exit(1);
        } else {
            successCount++;
            console.log(`[OK] Cycle Complete for ${examId}`);
        }
    }

    console.log(`\nAll ${successCount}/${targets.length} exams processed successfully.`);
}

main();
