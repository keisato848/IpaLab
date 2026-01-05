
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

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

async function main() {
    if (!API_KEY) {
        console.error("No API KEY found");
        return;
    }
    console.log("Using API Key ending in: ..." + API_KEY.slice(-4));

    // There is no direct "listModels" on the standard client instance usually, 
    // but looking at the error message, the SDK might provide it or I can try a simple generation to trigger the error with full output.
    // Actually, GoogleGenAI SDK doesn't always expose listModels simply.
    // But let's try a direct simple call to "gemini-1.5-flash" and print the FULL error to a file.

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        const result = await model.generateContent("Hello");
        const response = await result.response;
        console.log("Success with gemini-1.5-flash:", response.text());
        fs.writeFileSync('model-debug.txt', "Success with gemini-1.5-flash");
    } catch (e: any) {
        console.error("Error with gemini-1.5-flash");
        let errorMsg = e.message;
        if (e.response) errorMsg += JSON.stringify(e.response);

        fs.writeFileSync('model-debug.txt', errorMsg);
        console.log("Error written to model-debug.txt");
    }
}

main();
