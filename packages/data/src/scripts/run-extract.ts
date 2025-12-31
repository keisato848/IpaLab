
import { execSync } from 'child_process';
import path from 'path';

const scraperDir = path.resolve(__dirname, '../scraper');
const script = path.join(scraperDir, 'gemini-extract.ts');

try {
    console.log("Running extraction...");
    execSync(`ts-node ${script}`, { stdio: 'inherit', cwd: process.cwd() });
} catch (error) {
    console.error("Extraction failed:", error);
    process.exit(1);
}
