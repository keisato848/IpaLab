
import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as https from 'https';
import fs from 'fs';

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
const EXAM_CONTAINER_NAME = "Exams";

async function main() {
    if (!CONNECTION_STRING) {
        console.error("No Connection String found");
        return;
    }

    const isLocal = CONNECTION_STRING.includes('localhost') || CONNECTION_STRING.includes('127.0.0.1');
    let clientOptions: any = { connectionString: CONNECTION_STRING };
    if (isLocal) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        let finalConn = CONNECTION_STRING;
        if (CONNECTION_STRING.includes('localhost')) finalConn = CONNECTION_STRING.replace('localhost', '127.0.0.1');
        clientOptions = {
            connectionString: finalConn,
            agent: new https.Agent({ rejectUnauthorized: false })
        };
    }

    const client = new CosmosClient(clientOptions);
    const database = client.database(DATABASE_NAME);
    const container = database.container(EXAM_CONTAINER_NAME);

    console.log("Querying Exams...");
    const { resources: exams } = await container.items.query("SELECT c.id, c.title, c.category FROM c").fetchAll();

    console.log(`Found ${exams.length} exams.`);
    const pm2025 = exams.find(e => e.id === 'PM-2025-Fall-AM2');
    if (pm2025) {
        console.log("FOUND PM-2025:", pm2025);
    } else {
        console.log("PM-2025 NOT FOUND in DB.");
        console.log("Listing all IDs:");
        exams.forEach(e => console.log(` - ${e.id} (${e.title})`));
    }
}

main().catch(console.error);
