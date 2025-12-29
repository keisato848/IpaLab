import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log(`Checking connectivity with key ending in ...${apiKey?.slice(-4)}`);
    const genAI = new GoogleGenerativeAI(apiKey!);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent("Hello, are you there?");
        console.log("Response:", result.response.text());
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
