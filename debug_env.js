const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve(__dirname, 'apps/web/.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('GEMINI') || trimmed.startsWith('APPLICATIONINSIGHTS')) {
            const [key, val] = trimmed.split('=');
            if (val) {
                console.log(`${key}=${val.trim().substring(0, 5)}... (len: ${val.trim().length})`);
            }
        }
    });
} catch (e) {
    console.error(e.message);
}
