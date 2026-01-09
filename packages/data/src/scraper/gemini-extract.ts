import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
const envPaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env')
];

envPaths.forEach(envPath => {
    dotenv.config({ path: envPath });
});

// Load API Keys
const apiKeys: string[] = [];
if (process.env.GEMINI_API_KEY) apiKeys.push(process.env.GEMINI_API_KEY);
for (let i = 1; i <= 4; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) apiKeys.push(key);
}

if (apiKeys.length === 0) {
    throw new Error('No GEMINI_API_KEY found in environment variables.');
}

console.log(`Loaded ${apiKeys.length} API keys for rotation.`);

// Client factory with rotation
let keyIndex = 0;
function getGeminiClient() {
    const key = apiKeys[keyIndex];
    keyIndex = (keyIndex + 1) % apiKeys.length; // Round-robin
    return {
        fileManager: new GoogleAIFileManager(key),
        model: new GoogleGenerativeAI(key).getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig: {
                responseMimeType: "application/json"
            }
        }),
        keyIndex: (keyIndex === 0 ? apiKeys.length : keyIndex) - 1 // Return logical index of key used
    };
}

async function uploadToGemini(client: { fileManager: GoogleAIFileManager }, filePath: string, mimeType: string) {
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const uploadResult = await client.fileManager.uploadFile(filePath, {
                mimeType,
                displayName: path.basename(filePath),
            });
            const file = uploadResult.file;
            console.log(`Uploaded file ${file.displayName} as: ${file.name} (URI: ${file.uri})`);
            return file;
        } catch (error: any) {
            console.error(`Upload failed (attempt ${i + 1}/${maxRetries}):`, error.message);
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
    }
    throw new Error("Unreachable");
}

async function waitForActive(client: { fileManager: GoogleAIFileManager }, file: any) {
    let currentState = file.state;
    console.log(`Waiting for file processing... (Current: ${currentState})`);
    while (currentState === "PROCESSING") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const currentFile = await client.fileManager.getFile(file.name);
        currentState = currentFile.state;
        console.log(`State: ${currentState}`);
    }
    if (currentState !== "ACTIVE") {
        throw new Error(`File processing failed: ${currentState}`);
    }
}


async function generateWithRetry(client: { model: any }, promptParts: any[], maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await client.model.generateContent(promptParts);
        } catch (error: any) {
            console.error(`Generation failed (attempt ${i + 1}/${maxRetries}):`, error.message);

            // If Rate Limit (429) or Overloaded (503), we should failing fast?
            // Actually, simply waiting 60s per key is one strategy.
            // But if we have 5 keys, we should just ROTATE.
            // However, our current architecture passes a single `client` (bound to 1 key) to this function.
            // To support rotation *within* this retry loop, we would need to request a new client/key here.

            // For now, let's keep the wait strategy but maybe reduce it if we had rotation logic here.
            // Given the current structure, let's Stick to the wait 
            // BUT, if we hit 429, maybe throw immediately so the Caller can retry with a new client?
            // The caller (extractQuestions) does NOT have a retry loop for *extraction*, only *upload* has internal retries.

            // OPTIMIZATION: Just wait.
            if (error.status === 429 || error.message?.includes('429')) {
                console.log("Rate limit hit. Waiting 20s...");
                await new Promise(r => setTimeout(r, 20000));
            } else {
                await new Promise(r => setTimeout(r, 5000));
            }
            if (i === maxRetries - 1) throw error;
        }
    }
    throw new Error("Max retries exceeded");
}

// Updated to accept client instance
async function extractQuestions(examId: string, rawDir: string, outDir: string, startClientIndex: number) {
    const filePath = path.join(rawDir, `${examId}.pdf`);
    const isAfternoon = examId.includes('-PM');
    const promptPath = isAfternoon
        ? path.resolve(__dirname, '../../../../docs/prompts/gemini_pm_ocr_prompt.md')
        : path.resolve(__dirname, '../../../../docs/prompts/gemini_ocr_prompt.md');

    try {
        await fs.access(filePath);
    } catch {
        console.warn(`Question PDF not found for ${examId}`);
        return;
    }

    let promptText = await fs.readFile(promptPath, 'utf-8');
    promptText += "\n\nIMPORTANT: Output ONLY the JSON array. Do not wrap in markdown code blocks.";

    // Retry loop for KEY ROTATION
    const MAX_KEY_RETRIES = 5;
    let success = false;

    for (let attempts = 0; attempts < MAX_KEY_RETRIES; attempts++) {
        // Create a fresh client for this attempt
        const client = getGeminiClient();
        console.log(`[Key #${client.keyIndex}] Extracting QUESTIONS for ${examId}... (Attempt ${attempts + 1})`);

        try {
            const file = await uploadToGemini(client, filePath, "application/pdf");
            await waitForActive(client, file);

            // We use a small internal retry for transient errors, but if it fails, we catch and ROTATE key.
            const result = await client.model.generateContent([
                { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
                { text: promptText }
            ]);

            const responseText = result.response.text();
            const examDir = path.join(outDir, examId);
            await fs.mkdir(examDir, { recursive: true });

            let jsonStr = formatJson(responseText);
            await fs.writeFile(path.join(examDir, 'questions_raw.json'), jsonStr);
            console.log(`[Key #${client.keyIndex}] Saved raw Questions to ${path.join(examDir, 'questions_raw.json')}`);
            success = true;
            break; // Success!

        } catch (e: any) {
            console.error(`[Key #${client.keyIndex}] Error extracting questions for ${examId}:`, e.message);

            if (e.status === 429 || e.message?.includes('429') || e.status === 503) {
                console.log(`[Key #${client.keyIndex}] Quota exceeded or Overloaded. Switching to next key...`);
                // Continue loop -> gets new client -> new key
                await new Promise(r => setTimeout(r, 2000)); // Small pause
            } else {
                // Non-recoverable or unknown error? 
                // For now, let's treat most errors as "try another key" unless it's file IO
                console.log(`[Key #${client.keyIndex}] Unexpected error. Switching key just in case...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    if (!success) {
        console.error(`Failed to extract QUESTIONS for ${examId} after ${MAX_KEY_RETRIES} key rotations.`);
    }
}

async function extractAnswers(examId: string, rawDir: string, outDir: string, startClientIndex: number) {
    const filePath = path.join(rawDir, `${examId}-Ans.pdf`);
    const promptPath = path.resolve(__dirname, '../../../../docs/prompts/gemini_answer_ocr_prompt.md');

    try {
        await fs.access(filePath);
    } catch {
        console.warn(`Answer PDF not found for ${examId}`);
        return;
    }

    let promptText = await fs.readFile(promptPath, 'utf-8');
    promptText += "\n\nIMPORTANT: Output ONLY the JSON object. Do not wrap in markdown code blocks.";

    // Retry loop for KEY ROTATION
    const MAX_KEY_RETRIES = 5;
    let success = false;

    for (let attempts = 0; attempts < MAX_KEY_RETRIES; attempts++) {
        const client = getGeminiClient();
        console.log(`[Key #${client.keyIndex}] Extracting ANSWERS for ${examId}... (Attempt ${attempts + 1})`);

        try {
            const file = await uploadToGemini(client, filePath, "application/pdf");
            await waitForActive(client, file);

            const result = await client.model.generateContent([
                { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
                { text: promptText }
            ]);

            const responseText = result.response.text();
            const examDir = path.join(outDir, examId);
            await fs.mkdir(examDir, { recursive: true });

            let jsonStr = formatJson(responseText);
            await fs.writeFile(path.join(examDir, 'answers_raw.json'), jsonStr);
            console.log(`[Key #${client.keyIndex}] Saved raw Answers to ${path.join(examDir, 'answers_raw.json')}`);
            success = true;
            break;

        } catch (e: any) {
            console.error(`[Key #${client.keyIndex}] Error extracting answers for ${examId}:`, e.message);
            if (e.status === 429 || e.message?.includes('429') || e.status === 503) {
                console.log(`[Key #${client.keyIndex}] Quota exceeded. Switching to next key...`);
                await new Promise(r => setTimeout(r, 2000));
            } else {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }
    if (!success) {
        console.error(`Failed to extract ANSWERS for ${examId} after ${MAX_KEY_RETRIES} key rotations.`);
    }
}

function formatJson(text: string): string {
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    return jsonStr;
}

async function main() {
    const rawDir = path.resolve(__dirname, '../../data/raw_pdfs');
    const outDir = path.resolve(__dirname, '../../data/questions');

    const files = await fs.readdir(rawDir);
    // Filter for Question PDFs (exclude -Ans.pdf) AND specific target: Morning Exams (AP, PM, SC, IP)
    let examFiles = files.filter(f =>
        f.endsWith('.pdf') &&
        !f.endsWith('-Ans.pdf') &&
        (
            (f.startsWith('AP-') && f.includes('-AM')) ||
            (f.startsWith('FE-') && f.includes('-AM')) ||
            (f.startsWith('PM-') && f.includes('-AM2')) ||
            (f.startsWith('SC-') && f.includes('-AM2')) ||
            (f.startsWith('IP-') && f.includes('-AM'))
        )
    );

    // Sort Newest First
    examFiles.sort((a, b) => {
        const aIsIP = a.startsWith('IP-');
        const bIsIP = b.startsWith('IP-');
        if (aIsIP && !bIsIP) return -1;
        if (!aIsIP && bIsIP) return 1;
        return b.localeCompare(a);
    });

    console.log(`Found ${examFiles.length} exams. Processing with key rotation.`);

    for (const file of examFiles) {
        const examId = path.basename(file, '.pdf');
        console.log(`--- Processing ${examId} ---`);

        const examOutDir = path.join(outDir, examId);
        await fs.mkdir(examOutDir, { recursive: true });

        // Process Questions and Answers in parallel
        await Promise.all([
            (async () => {
                const qOut = path.join(examOutDir, 'questions_raw.json');
                let skipQ = false;
                try {
                    await fs.access(qOut);
                    console.log(`[SKIP] Questions for ${examId} already exist.`);
                    skipQ = true;
                } catch { }

                if (!skipQ) {
                    await extractQuestions(examId, rawDir, outDir, 0);
                }
            })(),
            (async () => {
                const aOut = path.join(examOutDir, 'answers_raw.json');
                let skipA = false;
                try {
                    await fs.access(aOut);
                    console.log(`[SKIP] Answers for ${examId} already exist.`);
                    skipA = true;
                } catch { }

                if (!skipA) {
                    await extractAnswers(examId, rawDir, outDir, 0);
                }
            })()
        ]);

        // Small buffer
        await new Promise(r => setTimeout(r, 1000));
    }
}

if (require.main === module) {
    main();
}
