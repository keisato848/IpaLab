import * as fs from 'fs';
import * as path from 'path';

const targetFile = path.resolve(__dirname, '../../data/questions/FE-2024-Public-PM/questions_raw.json');
const errorPos = 16660;

function main() {
    console.log(`Checking ${targetFile} at position ${errorPos}...`);
    try {
        const content = fs.readFileSync(targetFile, 'utf-8');
        const start = Math.max(0, errorPos - 100);
        const end = Math.min(content.length, errorPos + 100);
        console.log("--- Snippet ---");
        console.log(content.substring(start, end));
        console.log("--- End Snippet ---");
        console.log(`Char at ${errorPos}: '${content.charAt(errorPos)}'`);
    } catch (e) {
        console.error(e);
    }
}

main();
