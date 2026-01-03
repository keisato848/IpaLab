
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const DATA_DIR = path.resolve(__dirname, '../../data/questions');

// Default mapping based on Category
const DEFAULT_SUBCATEGORIES: Record<string, string> = {
    'Technology': 'テクノロジ系',
    'Management': 'マネジメント系',
    'Strategy': 'ストラテジ系',
    'Other': 'その他'
};

async function main() {
    console.log(`Scanning for questions_raw.json in ${DATA_DIR}...`);
    const files = await glob(`${DATA_DIR}/**/questions_raw.json`);

    let totalFixed = 0;
    let totalFiles = 0;

    for (const file of files) {
        // Extract Exam ID context from path
        // e.g. .../data/questions/FE-2019-Spring-AM/questions_raw.json -> FE-2019-Spring-AM
        const parentDir = path.basename(path.dirname(file));

        let content = fs.readFileSync(file, 'utf-8');
        let data: any;
        try {
            data = JSON.parse(content);
        } catch (e) {
            console.error(`Failed to parse ${file}:`, e);
            continue;
        }

        let questions: any[] = [];
        let isRootArray = Array.isArray(data);

        if (isRootArray) {
            questions = data;
        } else if (data.questions && Array.isArray(data.questions)) {
            questions = data.questions;
        } else {
            console.warn(`Skipping ${file}: Unknown structure`);
            continue;
        }

        let fileModified = false;

        for (const q of questions) {
            // Check for subCategory (camelCase seems to be the standard in viewed file)
            // But also check 'subcategory' (lowercase) just in case
            const currentSub = q.subCategory || q.subcategory;

            if (!currentSub || currentSub.trim() === '') {
                // Determine default
                const category = q.category || 'Other';
                const defaultSub = DEFAULT_SUBCATEGORIES[category] || category; // Fallback to category name itself

                q.subCategory = defaultSub; // Standardize to subCategory

                // Remove lowercase variant if it existed to clean up
                if (q.subcategory) delete q.subcategory;

                fileModified = true;
                totalFixed++;
            } else {
                // Ensure standardization if mixed casing exists
                if (q.subcategory && !q.subCategory) {
                    q.subCategory = q.subcategory;
                    delete q.subcategory;
                    fileModified = true;
                }
            }
        }

        if (fileModified) {
            // Write back
            const newContent = isRootArray ? questions : { ...data, questions };
            fs.writeFileSync(file, JSON.stringify(newContent, null, 2));
            console.log(`Updated ${parentDir} (${questions.length} items)`);
            totalFiles++;
        }
    }

    console.log(`\nFix Complete.`);
    console.log(`Files updated: ${totalFiles}`);
    console.log(`Total questions fixed: ${totalFixed}`);
    console.log(`\nNext Step: Run 'npm run sync-db' to propagate changes to the database.`);
}

main().catch(console.error);
