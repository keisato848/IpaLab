
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';
import * as https from 'https';

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

let CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || process.env.Values_COSMOS_DB_CONNECTION;
// Logic moved inside main()

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
    category?: string;
    subCategory?: string;
}

interface ExplanationMap {
    [key: string]: string;
}

interface RawPMQuestion {
    qNo: number;
    theme?: string;
    description: string;
    questions: any[];
}

async function main() {
    if (!CONNECTION_STRING) {
        console.error("Error: COSMOS_DB_CONNECTION environment variable is not set.");
        // Try to hint where it might be looking
        console.log("Checked paths:", possibleEnvPaths);
        process.exit(1);
    }

    // Determine if we are using Local Emulator
    const isLocal = CONNECTION_STRING.includes('localhost') || CONNECTION_STRING.includes('127.0.0.1');
    let finalConnectionString = CONNECTION_STRING;
    let clientOptions: any = {};

    if (isLocal) {
        console.log("Detected Local Cosmos DB Emulator.");
        if (CONNECTION_STRING.includes('localhost')) {
            finalConnectionString = CONNECTION_STRING.replace('localhost', '127.0.0.1');
        }
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        clientOptions = {
            connectionString: finalConnectionString,
            agent: new https.Agent({ rejectUnauthorized: false })
        };
    } else {
        console.log("Detected Cloud Cosmos DB connection.");
        clientOptions = {
            connectionString: finalConnectionString
        };
    }

    console.log(`Using Connection String Endpoint: ${finalConnectionString.split(';')[0]}`);

    try {
        const client = new CosmosClient(clientOptions);
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

            const examId = folderName; // Use full folder name (e.g. AP-2024-Spring-PM) as logic ID
            // const abbreviatedId = `${examPrefix}-${yearStr}${seasonStr}`; // OLD logic

            let type = 'AM1';
            if (examTypeRaw.includes('AM2')) type = 'AM2';
            else if (examTypeRaw.includes('PM1')) type = 'PM1';
            else if (examTypeRaw.includes('PM2')) type = 'PM2';
            else if (folderName.includes('PM')) type = 'PM'; // Fallback for PM folders without numerical suffix
            else type = 'AM1'; // Default

            try {
                // Logic...
            } catch (err: any) {
                console.error(`Failed to process ${folderName}:`, err.message);
                continue;
            }
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
