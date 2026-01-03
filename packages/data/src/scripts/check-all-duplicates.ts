
import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

// Load env
const possibleEnvPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
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

async function main() {
    if (!CONNECTION_STRING) {
        throw new Error("No Connection String");
    }

    const isLocal = CONNECTION_STRING.includes('localhost') || CONNECTION_STRING.includes('127.0.0.1');
    const clientOptions: any = { connectionString: CONNECTION_STRING };
    if (isLocal) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        clientOptions.agent = new https.Agent({ rejectUnauthorized: false });
    }

    const client = new CosmosClient(clientOptions);
    const database = client.database(DATABASE_NAME);
    const questionsContainer = database.container(CONTAINER_NAME);
    const examsContainer = database.container(EXAM_CONTAINER_NAME);

    console.log(`Fetching all exams from ${EXAM_CONTAINER_NAME}...`);
    const { resources: exams } = await examsContainer.items.query("SELECT * FROM c").fetchAll();
    console.log(`Found ${exams.length} exams.`);

    let totalDuplicates = 0;

    for (const exam of exams) {
        const examId = exam.id;
        // console.log(`Checking ${examId}...`);

        const query = `SELECT c.id, c.qNo, c.text FROM c WHERE c.examId = '${examId}'`;
        const { resources: questions } = await questionsContainer.items.query(query).fetchAll();

        const byQNo: Record<string, any[]> = {};
        for (const q of questions) {
            const key = q.qNo; // number or string
            if (!byQNo[key]) byQNo[key] = [];
            byQNo[key].push(q);
        }

        let duplicatesInExam = 0;
        for (const qNo in byQNo) {
            if (byQNo[qNo].length > 1) {
                duplicatesInExam += (byQNo[qNo].length - 1);
                console.log(`[DUPLICATE] Exam: ${examId}, QNo: ${qNo}, Count: ${byQNo[qNo].length}`);
                byQNo[qNo].forEach(r => console.log(`   - ID: ${r.id}, Text: ${(r.text || "").substring(0, 20)}...`));
            }
        }

        if (duplicatesInExam > 0) {
            totalDuplicates += duplicatesInExam;
        }
    }

    if (totalDuplicates === 0) {
        console.log("\nNo duplicates found in any exam!");
    } else {
        console.log(`\nFound total ${totalDuplicates} duplicate questions entries.`);
    }
}

main().catch(console.error);
