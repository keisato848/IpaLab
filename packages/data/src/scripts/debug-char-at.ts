import * as fs from 'fs';
import * as path from 'path';

const FILE_PATH = path.join(__dirname, '../../data/questions/SC-2021-Fall-PM2/questions_raw.json');
const TARGET_INDEX = 3846; // Position from error message
const content = fs.readFileSync(FILE_PATH, 'utf-8');
// Do NOT split by newline to check absolute index if error is absolute
// But JSON5 error "at 4:4206" means Line 4 (1-indexed), Column 4206.
// Line 1: {
// Line 2: "qNo": ...
// Line 3: "theme": ...
// Line 4: "description": ...

const lines = content.split('\n');
const line4 = lines[3]; // Line 4
console.log(`Line 4 length: ${line4.length}`);

// If line 4 is the description, it should be huge.
if (line4.length < 100) {
    console.log("Line 4 is suspiciously short. Dumping first 5 lines:");
    lines.slice(0, 5).forEach((l, i) => console.log(`${i + 1}: ${l}`));
} else {
    // The error is at Column 4206.
    const target = 4206;
    const start = Math.max(0, target - 50);
    const end = Math.min(line4.length, target + 50);
    console.log(`Context around col ${target} of Line 4:`);
    console.log(line4.substring(start, end));
    // Check for unescaped quotes logic
    // We assume Line 4 starts with '  "description": "' or similar.
    // Find value start index.
    const valStart = line4.indexOf('": "');
    if (valStart === -1) {
        console.log("Could not find key-value separator.");
    } else {
        const strStart = valStart + 4; // ": " is 4 chars. Quote is at valStart+3? ": " -> quote at +3.
        // ": " -> index of " is valStart. No. indexOf returns start of match.
        // match: `": "`
        // index point to `"` of `":`.
        // `description": "` -> `": "` starts at `n`?
        // Let's just Regex find `"description": "`.

        console.log("Searching for unescaped quotes after the value start...");
        // Iterate from strStart + 1
        for (let i = strStart + 1; i < line4.length; i++) {
            if (line4[i] === '"') {
                // Check backslashes
                let bsCount = 0;
                let j = i - 1;
                while (j >= 0 && line4[j] === '\\') {
                    bsCount++;
                    j--;
                }
                if (bsCount % 2 === 0) {
                    console.log(`FOUND UNESCAPED QUOTE at index ${i}!`);
                    console.log(`Context: ${line4.substring(i - 20, i + 20)}`);
                    break;
                }
            }
        }
    }
}
