
const fs = require('fs');
const path = require('path');

const targetPath = path.join(process.cwd(), 'packages/data/data/questions/FE-2019-Fall-AM/questions_raw.json');

try {
    const rawData = fs.readFileSync(targetPath, 'utf-8');

    // Remove Start '[' and End ']'
    const inner = rawData.trim().replace(/^\[/, '').replace(/\]$/, '');

    // Split by "  }," which is the standard separator
    const chunks = inner.split(/\n  \},\r?\n/);

    const cleanQuestions = [];

    for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i].trim();

        // Remove leading comma if present
        chunk = chunk.replace(/^,\s*/, '');

        // Add back closing brace if missing
        if (!chunk.endsWith('}')) {
            chunk += '}';
        }

        try {
            const q = JSON.parse(chunk);

            // Mojibake check
            const textBad = q.text && typeof q.text === 'string' && q.text.includes('縺');
            const optionsBad = q.options && Array.isArray(q.options) && q.options.some(o => o.text && typeof o.text === 'string' && o.text.includes('縺'));

            if (textBad || optionsBad) {
                console.log(`Skipping Q${q.qNo} due to mojibake.`);
                continue;
            }

            // Validation check
            if (q.qNo && q.text) {
                cleanQuestions.push(q);
            }
        } catch (e) {
            console.log(`Skipping chunk ${i} due to parse error: ${e.message.slice(0, 50)}...`);
        }
    }

    console.log(`Recovered ${cleanQuestions.length} valid questions.`);

    fs.writeFileSync(targetPath, JSON.stringify(cleanQuestions, null, 2), 'utf-8');
    console.log('Saved cleaned JSON.');

} catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
}
