
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

async function main() {
    if (!CONNECTION_STRING) throw new Error("No Connection String");

    const isLocal = CONNECTION_STRING.includes('localhost') || CONNECTION_STRING.includes('127.0.0.1');
    const clientOptions: any = { connectionString: CONNECTION_STRING };
    if (isLocal) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        clientOptions.agent = new https.Agent({ rejectUnauthorized: false });
    }

    const client = new CosmosClient(clientOptions);
    const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

    const examId = "PM-2025-Fall-AM2";
    console.log(`Deleting questions for ${examId}...`);

    const query = `SELECT c.id, c.examId FROM c WHERE c.examId = '${examId}'`;
    const { resources } = await container.items.query(query).fetchAll();

    console.log(`Found ${resources.length} items to delete.`);

    let validCount = 0;
    for (const item of resources) {
        // Double check partition key
        if (item.examId === examId) {
            await container.item(item.id, item.examId).delete();
            process.stdout.write(".");
            validCount++;
        }
    }
    console.log(`\nDeleted ${validCount} items.`);
}

main().catch(console.error);
