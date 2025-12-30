import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
}

const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);

// Use a model that supports file input and JSON generation
const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
});

async function uploadToGemini(filePath: string, mimeType: string) {
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const uploadResult = await fileManager.uploadFile(filePath, {
                mimeType,
                displayName: path.basename(filePath),
            });
            const file = uploadResult.file;
            console.log(`Uploaded file ${file.displayName} as: ${file.name} (URI: ${file.uri})`);
            return file;
        } catch (error) {
            console.error(`Upload failed (attempt ${i + 1}/${maxRetries}):`, error);
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
    }
    throw new Error("Unreachable");
}

async function waitForActive(file: any) {
    let currentState = file.state;
    console.log(`Waiting for file processing... (Current: ${currentState})`);
    while (currentState === "PROCESSING") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const currentFile = await fileManager.getFile(file.name);
        currentState = currentFile.state;
        console.log(`State: ${currentState}`);
    }
    if (currentState !== "ACTIVE") {
        throw new Error(`File processing failed: ${currentState}`);
    }
}


async function generateWithRetry(promptParts: any[], maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await model.generateContent(promptParts);
        } catch (error: any) {
            console.error(`Generation failed (attempt ${i + 1}/${maxRetries}):`, error.message);
            if (error.status === 429 || error.message?.includes('429')) {
                console.log("Rate limit hit. Waiting 60s...");
                await new Promise(r => setTimeout(r, 60000));
            } else {
                await new Promise(r => setTimeout(r, 5000));
            }
            if (i === maxRetries - 1) throw error;
        }
    }
    throw new Error("Max retries exceeded");
}

async function extractQuestions(examId: string, rawDir: string, outDir: string) {
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

    console.log(`Extracting Questions for ${examId}...`);
    try {
        const file = await uploadToGemini(filePath, "application/pdf");
        await waitForActive(file);

        const result = await generateWithRetry([
            { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
            { text: promptText }
        ]);

        const responseText = result.response.text();
        const examDir = path.join(outDir, examId);
        await fs.mkdir(examDir, { recursive: true });

        let jsonStr = formatJson(responseText);
        // PM returns a single object usually, but AM returns an array.
        // The implementation_plan expects questions_raw.json to be an array for synchronization.
        // If PM returns a single object (Concept), we might need to wrap it or adapt sync-db.
        // For now, save raw as returned.
        await fs.writeFile(path.join(examDir, 'questions_raw.json'), jsonStr);
        console.log(`Saved raw Questions to ${path.join(examDir, 'questions_raw.json')}`);
    } catch (e) {
        console.error("Error extracting questions:", e);
    }
}

async function extractAnswers(examId: string, rawDir: string, outDir: string) {
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

    console.log(`Extracting Answers for ${examId}...`);
    try {
        const file = await uploadToGemini(filePath, "application/pdf");
        await waitForActive(file);

        const result = await generateWithRetry([
            { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
            { text: promptText }
        ]);

        const responseText = result.response.text();
        const examDir = path.join(outDir, examId);
        await fs.mkdir(examDir, { recursive: true });

        let jsonStr = formatJson(responseText);
        await fs.writeFile(path.join(examDir, 'answers_raw.json'), jsonStr);
        console.log(`Saved raw Answers to ${path.join(examDir, 'answers_raw.json')}`);
    } catch (e) {
        console.error("Error extracting answers:", e);
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
    // Filter for Question PDFs (exclude -Ans.pdf)
    let examFiles = files.filter(f => f.endsWith('.pdf') && !f.endsWith('-Ans.pdf'));

    // Prioritize PM exams (Reverse Alphabetical: PM before AP)
    examFiles.sort((a, b) => b.localeCompare(a));

    console.log(`Found ${examFiles.length} potential exams. Processing PM first.`);

    for (const file of examFiles) {
        const examId = path.basename(file, '.pdf');

        // Allow both AM and PM
        // if (!examId.includes('AM')) { ... } 

        console.log(`--- Processing ${examId} ---`);

        const examOutDir = path.join(outDir, examId);
        await fs.mkdir(examOutDir, { recursive: true });

        // Questions
        const qOut = path.join(examOutDir, 'questions_raw.json');
        let skipQ = false;
        try {
            await fs.access(qOut);
            console.log(`[SKIP] Questions for ${examId} already exist.`);
            skipQ = true;
        } catch { }

        if (!skipQ) {
            await extractQuestions(examId, rawDir, outDir);
            await new Promise(r => setTimeout(r, 2000));
        }

        // Answers
        const aOut = path.join(examOutDir, 'answers_raw.json');
        let skipA = false;
        try {
            await fs.access(aOut);
            console.log(`[SKIP] Answers for ${examId} already exist.`);
            skipA = true;
        } catch { }

        if (!skipA) {
            await extractAnswers(examId, rawDir, outDir);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

if (require.main === module) {
    main();
}
