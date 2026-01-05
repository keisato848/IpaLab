
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '../../../../apps/web/.env.local');
dotenv.config({ path: envPath });

const API_KEY = (process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY) as string;

async function testModel(modelName: string) {
    console.log(`Testing model: ${modelName}`);
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
        const result = await model.generateContent("Hello, world!");
        const response = await result.response;
        console.log(`[SUCCESS] ${modelName}:`, response.text());
    } catch (e: any) {
        console.error(`[FAILURE] ${modelName}:`, e.message);
    }
}

async function main() {
    await testModel("gemini-1.5-flash");
    await testModel("gemini-flash-latest");
    await testModel("gemini-1.5-flash-latest");
    await testModel("gemini-pro");
}

main();
