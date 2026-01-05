
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../../../apps/web/.env.local');
dotenv.config({ path: envPath });

const API_KEY = (process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY) as string;

async function main() {
    console.log("Checking available models...");
    /* 
       Note: The Node SDK generic listModels method might not be exposed directly in 
       older versions or specific configurations, but let's try a standard generation 
       on a known model to verify connectivity first, then try to deduce accessible models.
       
       Actually, the SDK doesn't always have a listModels method easily accessible 
       without the model text. Let's try 1.5-pro again with a minimal prompt to isolate 
       if it's the model name or the content.
    */

    const genAI = new GoogleGenerativeAI(API_KEY);

    const candidates = ["gemini-1.5-pro", "gemini-1.5-pro-latest", "gemini-pro"];

    for (const m of candidates) {
        console.log(`Testing connection to ${m}...`);
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Test");
            const response = await result.response;
            console.log(`  [OK] ${m} responded: ${response.text().substring(0, 20)}...`);
        } catch (e: any) {
            console.log(`  [FAIL] ${m}: ${e.message.split('\n')[0]}`);
        }
    }
}

main();
