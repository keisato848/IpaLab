const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

function getKeys() {
    try {
        const envPath = path.resolve(__dirname, 'apps/web/.env.local');
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const lines = envContent.split('\n');
        const keys = [];
        lines.forEach(line => {
            if (line.trim().startsWith('GEMINI_API_KEY')) {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    let val = parts.slice(1).join('='); // Handle value with =
                    val = val.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
                    if (val) keys.push(val);
                }
            }
        });
        return keys;
    } catch (e) {
        console.error("Could not read .env.local", e.message);
        return [];
    }
}

async function testModel(apiKey, modelName) {
    // console.log(`Testing key ending in ...${apiKey.slice(-5)} with ${modelName}`);
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        console.log(`[PASS] Key(...${apiKey.slice(-5)}) + ${modelName}:`, result.response.text());
        return true;
    } catch (e) {
        // console.error(`[FAIL] Key(...${apiKey.slice(-5)}) + ${modelName}:`, e.message.split(' ')[0]); // Brief error
        return false;
    }
}

async function run() {
    const keys = getKeys();
    console.log(`Found ${keys.length} keys.`);
    const models = ["gemini-1.5-flash", "gemini-2.0-flash-exp", "gemini-3-flash-preview"];

    for (const key of keys) {
        for (const model of models) {
            const success = await testModel(key, model);
            if (success) {
                console.log(`\n>>> FOUND WORKING COMBINATION: Key ending in ...${key.slice(-5)} with Model: ${model}`);
                return; // Exit on first success
            }
        }
    }
    console.log("No working combination found.");
}

run();
