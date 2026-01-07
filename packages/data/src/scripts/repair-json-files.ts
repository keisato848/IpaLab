
import * as fs from 'fs';
import * as path from 'path';
import { jsonrepair } from 'jsonrepair';

const questionsDir = path.resolve(__dirname, '../../data/questions');

function main() {
    console.log("Repairing corrupted JSON files...");

    const dirs = fs.readdirSync(questionsDir);
    let fixedCount = 0;

    for (const dir of dirs) {
        const jsonPath = path.join(questionsDir, dir, 'questions_raw.json');
        if (!fs.existsSync(jsonPath)) continue;

        try {
            const content = fs.readFileSync(jsonPath, 'utf-8');
            try {
                JSON.parse(content);
                // Valid, but maybe we want to run repair anyway?
                // No, only if failed.
            } catch (e) {
                console.log(`Repairing ${dir}...`);
                try {
                    const repaired = jsonrepair(content);
                    // Verify
                    JSON.parse(repaired);
                    fs.writeFileSync(jsonPath, repaired);
                    console.log(`  Fixed ${dir}`);
                    fixedCount++;
                } catch (repairError) {
                    console.error(`  Failed to repair ${dir}:`, repairError);
                }
            }
        } catch (e) {
            console.error(`Error processing ${dir}:`, e);
        }
    }
    console.log(`Done. Fixed ${fixedCount} files.`);
}

main();
