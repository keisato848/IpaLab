import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log(`Using key: ...${apiKey?.slice(-4)}`);
    const genAI = new GoogleGenerativeAI(apiKey!);
    try {
        // Use a basic model to just testing
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        // Actually, we want to list models, but the SDK doesn't expose listModels directly on genAI instance usually?
        // Wait, the new SDK might not have listModels on the top level easily exposed in node?
        // Let's trying raw fetch to list models.

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach((m: any) => console.log(m.name));
        } else {
            console.log("No models found or error:", JSON.stringify(data));
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
