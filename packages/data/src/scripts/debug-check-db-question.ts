
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
    const database = client.database(DATABASE_NAME);
    const container = database.container(CONTAINER_NAME);

    const examId = "AP-2025-Fall-AM";
    const qNo = 1;
    // Standard ID
    const id = `${examId}-${qNo}`;

    console.log(`Checking DB for ${id} (in partition ${examId})...`);

    try {
        const { resource: item } = await container.item(id, examId).read();
        if (item) {
            console.log("Found Item:");
            console.log(`ID: ${item.id}`);
            console.log(`Explanation length: ${item.explanation ? item.explanation.length : 'MISSING'}`);
            console.log(`Explanation start: ${item.explanation ? item.explanation.substring(0, 50) : 'NULL'}`);
        } else {
            console.log("Item NOT FOUND by direct read.");
        }
    } catch (e: any) {
        console.error("Error reading item:", e.message);
    }

    // Also query to find any duplicates or weird IDs
    console.log(`\nQuerying all items for ${examId} Q${qNo}...`);
    const query = `SELECT * FROM c WHERE c.examId = '${examId}' AND c.qNo = ${qNo}`;
    const { resources: items } = await container.items.query(query).fetchAll();

    console.log(`Found ${items.length} items via query.`);
    items.forEach(i => {
        console.log(`- ID: ${i.id}, Explanation: ${i.explanation ? 'YES (' + i.explanation.length + ')' : 'NO'}`);
    });
}

main().catch(console.error);
