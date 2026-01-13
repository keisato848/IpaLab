const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve(__dirname, 'apps/web/.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/GEMINI_API_KEY=(.+)/);

    if (match) {
        let key = match[1].trim();
        console.log(`Key found. Length: ${key.length}`);
        console.log(`First char: ${key[0]}`);
        console.log(`Last char: ${key[key.length - 1]}`);
        console.log(`Is quoted double: ${key.startsWith('"') && key.endsWith('"')}`);
        console.log(`Is quoted single: ${key.startsWith("'") && key.endsWith("'")}`);
    } else {
        console.log("No key found via regex");
    }
} catch (e) {
    console.error(e.message);
}
