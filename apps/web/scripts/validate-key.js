
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
        if (line.startsWith('GEMINI_API_KEY')) {
            const parts = line.split('=');
            if (parts.length < 2) {
                console.log('GEMINI_API_KEY found but has no value.');
                return;
            }
            const value = parts.slice(1).join('=').trim();
            console.log(`Key Found. Length: ${value.length}`);
            console.log(`Starts with quote? ${value.startsWith('"') || value.startsWith("'")}`);
            console.log(`Ends with quote? ${value.endsWith('"') || value.endsWith("'")}`);
            console.log(`Contains whitespace? ${/\s/.test(value)}`);
            // Check if it looks like a valid key (starts with AIza...)
            if (value.startsWith('AIza')) {
                console.log('Prefix check: OK (Starts with AIza)');
            } else if (value.replace(/^["']/, '').startsWith('AIza')) {
                console.log('Prefix check: OK (Found AIza inside quotes)');
            } else {
                console.log('Prefix check: WARNING (Does not start with AIza)');
            }
        }
    });
} catch (e) {
    console.error('Error reading .env.local', e.message);
}
