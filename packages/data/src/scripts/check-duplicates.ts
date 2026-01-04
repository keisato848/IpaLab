
import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

const possibleEnvPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
];

for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
}

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || process.env.Values_COSMOS_DB_CONNECTION;
const DATABASE_NAME = "pm-exam-dx-db";
const CONTAINER_NAME = "Questions";
const EXAM_CONTAINER_NAME = "Exams";

async function main() {
    if (!CONNECTION_STRING) throw new Error("No Connection String");

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

    console.log(`Fetching exams...`);
    const { resources: exams } = await examsContainer.items.query("SELECT * FROM c").fetchAll();
    console.log(`Scanning ${exams.length} exams for duplicates...`);

    let totalDuplicates = 0;
    const duplicateDetails: string[] = [];

    for (const exam of exams) {
        const examId = exam.id;
        const query = `SELECT * FROM c WHERE c.examId = '${examId}'`;
        const { resources: questions } = await questionsContainer.items.query(query).fetchAll();

        const byQNo: Record<string, any[]> = {};
        for (const q of questions) {
            const key = q.qNo ?? "unknown";
            if (!byQNo[key]) byQNo[key] = [];
            byQNo[key].push(q);
        }

        for (const qNo in byQNo) {
            const items = byQNo[qNo];
            if (items.length > 1) {
                totalDuplicates += (items.length - 1);
                duplicateDetails.push(`[DUPLICATE] Exam: ${examId}, QNo: ${qNo}. Found ${items.length} items.`);
            }
        }
    }

    if (totalDuplicates === 0) {
        console.log("\nNo duplicates found. Data is clean.");
    } else {
        console.log(`\nFound ${totalDuplicates} duplicate questions!`);
        console.log(duplicateDetails.join('\n'));
    }
}

main().catch(console.error);
