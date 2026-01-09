
import * as fs from 'fs';
import * as path from 'path';

const targetPath = path.join(process.cwd(), 'packages/data/data/questions/FE-2019-Fall-AM/questions_raw.json');
const rawData = fs.readFileSync(targetPath, 'utf-8');

// Primitive but effective: Split by object boundaries assuming formatted JSON
// The file typically looks like:
// [
//   {
//     "qNo": 1,
//     ...
//   },
//   {
//     ...
//   }
// ]

// Remove Start '[' and End ']'
const inner = rawData.trim().replace(/^\[/, '').replace(/\]$/, '');
// Split by "  }," which is the standard separator in this generated file
const chunks = inner.split(/\n  \},\r?\n/);

const cleanQuestions = [];

for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i].trim();

    // Add back the closing brace if it was stripped by split (except for the last one if it didn't have comma)
    // Actually split removes the delimiter. The delimiter was "\n  },"
    // So we need to add "}" back.
    // Ensure we handle the very last element (which might not have a comma)

    // Heuristic: If it starts with space or comma, trim it
    chunk = chunk.replace(/^,\s*/, '');

    if (!chunk.endsWith('}')) {
        chunk += '}';
    }

    try {
        const q = JSON.parse(chunk);

        // Mojibake check
        const textBad = q.text && typeof q.text === 'string' && q.text.includes('縺');
        const optionsBad = q.options && Array.isArray(q.options) && q.options.some((o: any) => o.text && typeof o.text === 'string' && o.text.includes('縺'));

        if (textBad || optionsBad) {
            console.log(`Skipping Q${q.qNo} due to mojibake.`);
            continue;
        }

        // Validation check (must have qNo and text)
        if (q.qNo && q.text) {
            cleanQuestions.push(q);
        }
    } catch (e) {
        console.log(`Skipping chunk ${i} due to parse error: ${e.message.slice(0, 50)}...`);
        // If we hit a parse error, it's likely the beginning of the corruption. Stop here?
        // Or try to continue? Usually corruption is the tail.
        // Assuming tail corruption, we can stop or just skip.
    }
}

console.log(`Recovered ${cleanQuestions.length} valid questions.`);

fs.writeFileSync(targetPath, JSON.stringify(cleanQuestions, null, 2), 'utf-8');
console.log('Saved cleaned JSON.');
