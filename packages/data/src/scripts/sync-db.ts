
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';

// Load env vars
// Try loading from web/api local.settings.json or .env.local
const possibleEnvPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
    path.resolve(__dirname, '../../../../apps/api/local.settings.json')
];

for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        console.log(`Loading env from ${envPath}`);
        dotenv.config({ path: envPath });
    }
}

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || process.env.Values_COSMOS_DB_CONNECTION;
const DATABASE_NAME = "pm-exam-dx-db";
const CONTAINER_NAME = "Questions";
const EXAM_CONTAINER_NAME = "Exams";

const mapOptionToId = (jp: string): string | null => {
    const map: Record<string, string> = { 'ア': 'a', 'イ': 'b', 'ウ': 'c', 'エ': 'd' };
    return map[jp] || null;
};
// Simple types based on raw files
interface RawQuestion {
    qNo: number;
    text: string;
    options: { id: string, text: string }[];
    correctOption: string | null;
}

interface ExplanationMap {
    [key: string]: string;
}

async function main() {
    if (!CONNECTION_STRING) {
        console.error("Error: COSMOS_DB_CONNECTION environment variable is not set.");
        // Try to hint where it might be looking
        console.log("Checked paths:", possibleEnvPaths);
        process.exit(1);
    }

    console.log(`Connection string found. Length: ${CONNECTION_STRING.length}`);

    try {
        const client = new CosmosClient(CONNECTION_STRING);
        const database = client.database(DATABASE_NAME);
        const container = database.container(CONTAINER_NAME);

        // Create DB/Container if not exists
        console.log("Ensuring Database and Container exist...");
        await client.databases.createIfNotExists({ id: DATABASE_NAME });
        await database.containers.createIfNotExists({ id: CONTAINER_NAME, partitionKey: '/examId' });
        await database.containers.createIfNotExists({ id: EXAM_CONTAINER_NAME, partitionKey: '/id' });

        console.log("Database and Container ensured.");

        const dataDir = path.resolve(__dirname, '../../data/questions');
        const questionFiles = glob.sync('**/questions_raw.json', { cwd: dataDir });

        console.log(`Found ${questionFiles.length} question files.`);

        for (const file of questionFiles) {
            const dir = path.dirname(file);
            const folderName = dir.split(path.sep).pop()!;
            // Expected format: AP-2024-Spring-AM, PM-2024-Fall-AM2

            // Parse ID
            // Example: AP-2024-Spring-AM => examId: AP-2024S (System convention?), type: AM1
            // Example: PM-2024-Fall-AM2 => examId: PM-2024F, type: AM2

            let yearStr = "2024";
            let seasonStr = "S";
            let examTypeRaw = "AM";
            let examPrefix = "AP";

            const parts = folderName.split('-');
            if (parts.length >= 3) {
                examPrefix = parts[0];
                yearStr = parts[1];
                const seasonRaw = parts[2]; // Spring/Fall
                seasonStr = seasonRaw === 'Spring' ? 'S' : 'F';
                if (parts.length >= 4) {
                    examTypeRaw = parts[3];
                }
            }

            const examId = `${examPrefix}-${yearStr}${seasonStr}`;
            let type = 'AM1';
            if (examTypeRaw.includes('AM2')) type = 'AM2';
            else if (examTypeRaw.includes('PM1')) type = 'PM1';
            else if (examTypeRaw.includes('PM2')) type = 'PM2';
            else type = 'AM1'; // Default

            console.log(`Processing ${folderName} -> ExamID: ${examId}, Type: ${type}`);

            const questionsPath = path.join(dataDir, file);
            const explanationPath = path.join(dataDir, dir, 'explanations_raw.json');

            const questions: RawQuestion[] = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
            let explanations: ExplanationMap = {};
            if (fs.existsSync(explanationPath)) {
                explanations = JSON.parse(fs.readFileSync(explanationPath, 'utf8'));
            }

            const batch = [];

            for (const q of questions) {
                const explanation = explanations[q.qNo.toString()] || "";
                let correctOption = q.correctOption;

                // Try to extract correct option from explanation if null
                if (!correctOption && explanation) {
                    // Look for patterns like "**正解は「ア：...」" or "**正解は「ア」"
                    const match = explanation.match(/正解は.*?[「『]([ア-ン])[：』]/);
                    if (match && match[1]) {
                        correctOption = mapOptionToId(match[1]);
                    }
                }

                // Fallback if still null, default to 'a' but mark in log (or skip?)
                // Schema says string, not nullable. 
                if (!correctOption) {
                    console.warn(`Warning: No correct option found for ${examId}-${type}-${q.qNo}. Using 'a' as placeholder.`);
                    correctOption = 'a';
                }

                const id = `${examId}-${type}-${String(q.qNo).padStart(2, '0')}`;

                const doc = {
                    id: id,
                    qNo: q.qNo,
                    examId: examId,
                    type: type,
                    category: 'Technology', // Default
                    subCategory: 'General',
                    text: q.text,
                    options: q.options,
                    correctOption: correctOption,
                    explanation: explanation,
                    createdAt: new Date().toISOString()
                };

                batch.push(doc);
            }

            // Upsert batch
            console.log(`Upserting ${batch.length} items for ${folderName}...`);
            for (const item of batch) {
                await container.items.upsert(item);
            }

            // Sync Exam Metadata
            // folderName: AP-2024-Spring-AM, etc.
            // examId (without AM/PM suffix): AP-2024S ? No, user wants Exam List to be "AP-2024-Spring-AM" etc?
            // LocalExamRepository listed directories as IDs.
            // Let's create an Exam document for this folder.

            // Re-derive nice title
            let era = '';
            const yearNum = parseInt(yearStr);
            if (yearNum >= 2019) era = `令和${yearNum - 2018}年`;
            else if (yearNum >= 1989) era = `平成${yearNum - 1988}年`;

            const term = seasonStr === 'S' ? '春期' : '秋期';
            const typeLabel = type === 'AM1' ? '午前I' : (type === 'AM2' ? '午前II' : (type.startsWith('PM') ? '午後' : type));

            let categoryLabel = '応用情報技術者試験';
            if (examPrefix === 'PM') categoryLabel = 'プロジェクトマネージャ試験';
            else if (examPrefix === 'FE') categoryLabel = '基本情報技術者試験';

            const title = `${categoryLabel} ${era} ${term} ${typeLabel}`;

            const examDoc = {
                id: folderName, // Use folder name as ID to match LocalExamRepository logic
                title: title,
                date: `${yearStr}-01-01`, // Approximation
                category: examPrefix,
                stats: { total: batch.length, completed: 0, correctRate: 0 }
            };

            console.log(`Upserting Exam Metadata: ${folderName}`);
            await database.container(EXAM_CONTAINER_NAME).items.upsert(examDoc);
        }

        console.log("Done.");
    } catch (e: any) {
        console.error("Error during sync:", e?.message || e);
    }

}


main().catch(err => {
    console.error(err);
    process.exit(1);
});
