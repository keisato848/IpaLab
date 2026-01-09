
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
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

const apiKey = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API KEY found");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: apiKey });

async function main() {
    console.log("Testing with @google/genai SDK...");
    console.log("Model: gemini-1.5-flash");

    try {
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: {
                role: "user",
                parts: [{ text: "Explain how AI works in a few words" }]
            }
        });
        console.log("Success! Response:");
        console.log(response?.text);
        if (!response?.text) console.log(JSON.stringify(response, null, 2));
    } catch (e: any) {
        console.error("Error with gemini-1.5-flash:");
        console.error(e);

        console.log("\nRetrying with gemini-2.0-flash-exp (if available)...");
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash-exp",
                contents: {
                    role: "user",
                    parts: [{ text: "Explain how AI works in a few words" }]
                }
            });
            console.log("Success with 2.0! Response:");
            console.log(response?.text);
        } catch (e2: any) {
            console.error("Error with gemini-2.0-flash-exp:");
            console.error(e2);
        }
    }
}

main();
