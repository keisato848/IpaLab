
import { spawnSync } from 'child_process';
import path from 'path';

const scraperDir = path.resolve(__dirname, '../scraper');
const script = path.join(scraperDir, 'gemini-extract.ts');

try {
    console.log("Running extraction...");
    const result = spawnSync(process.execPath, ['--require', 'ts-node/register', script], {
        stdio: 'inherit',
        cwd: process.cwd(),
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
} catch (error) {
    console.error("Extraction failed:", error instanceof Error ? error.message : error);
    process.exit(1);
}
