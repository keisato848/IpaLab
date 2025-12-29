
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleAIFileManager } from '@google/generative-ai/server';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY is not set.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

const DATA_DIR = path.resolve(__dirname, '../../data/questions');
const PROMPT_PATH = path.resolve(__dirname, '../../../../docs/prompts/gemini_explanation_prompt.md');

// Delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log("Starting explanation generation...");

    // Read Prompt Template
    let promptTemplate = "";
    try {
        promptTemplate = await fs.readFile(PROMPT_PATH, 'utf-8');
    } catch (e) {
        console.error("Could not read prompt template:", e);
        process.exit(1);
    }

    const dirs = await fs.readdir(DATA_DIR);

    // Sort dirs reversely to process latest first
    dirs.sort((a, b) => b.localeCompare(a));

    for (const dir of dirs) {
        // Only process specific year if needed, or all.
        // For testing, let's target 2024 first.
        // if (!dir.includes("2024")) continue;

        const examDir = path.join(DATA_DIR, dir);
        const questionsPath = path.join(examDir, 'questions_raw.json');
        const answersPath = path.join(examDir, 'answers_raw.json');
        const explanationsPath = path.join(examDir, 'explanations_raw.json');

        // Check if raw files exist
        try {
            await fs.access(questionsPath);
            await fs.access(answersPath);
        } catch {
            console.log(`Skipping ${dir}: Raw files missing.`);
            continue;
        }

        console.log(`Processing ${dir}...`);

        let questions = JSON.parse(await fs.readFile(questionsPath, 'utf-8'));
        let answers = JSON.parse(await fs.readFile(answersPath, 'utf-8')); // { qNo: "a", ... }

        let explanations: any = {};
        try {
            const existing = await fs.readFile(explanationsPath, 'utf-8');
            explanations = JSON.parse(existing);
        } catch {
            // New file
        }

        let updated = false;

        for (const q of questions) {
            const qNo = q.qNo;
            if (explanations[qNo]) {
                process.stdout.write('.'); // Skip indicator
                continue;
            }

            const correct = answers[qNo];
            if (!correct) {
                console.warn(`\nMissing answer for Q${qNo} in ${dir}`);
                continue;
            }

            // Construct Prompt
            let optionsText = "";
            if (q.options) {
                q.options.forEach((opt: any) => {
                    optionsText += `${opt.id}: ${opt.text}\n`;
                });
            }

            const prompt = `${promptTemplate}\n\nInput:\nQuestion: "${q.text}"\nOptions:\n${optionsText}\nCorrect Answer: ${correct}`;

            // Retry loop
            let retries = 0;
            while (retries < 3) {
                try {
                    // Rate Limit: 15 RPM for free tier = 4s per req.
                    // We use 5000ms to be safe.
                    await delay(5000);

                    const result = await model.generateContent(prompt);
                    const response = result.response;
                    const text = response.text();

                    // Parse JSON from text (remove markdown code blocks)
                    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const json = JSON.parse(jsonStr);

                    if (json.explanation) {
                        explanations[qNo] = json.explanation;
                        updated = true;
                        process.stdout.write('Gen ');
                        break; // Success
                    } else {
                        console.error(`\nFailed to parse explanation for Q${qNo}`);
                        break;
                    }
                } catch (error: any) {
                    // Check for 429
                    if (error.status === 429 || (error.message && error.message.includes('429'))) {
                        console.log(`\nRate limit hit. Waiting 60s...`);
                        await delay(60000);
                        retries++;
                    } else {
                        console.error(`\nError generating Q${qNo}:`, error);
                        break;
                    }
                }
            }

            // Save periodically
            if (updated && qNo % 5 === 0) {
                await fs.writeFile(explanationsPath, JSON.stringify(explanations, null, 2));
            }
        }

        if (updated) {
            await fs.writeFile(explanationsPath, JSON.stringify(explanations, null, 2));
            console.log(`\nSaved explanations for ${dir}`);
        } else {
            console.log(`\nNo new explanations for ${dir}`);
        }
    }
}

main().catch(console.error);
