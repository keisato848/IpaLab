
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
    if (!CONNECTION_STRING) {
        console.error("No Connection String");
        return;
    }

    const isLocal = CONNECTION_STRING.includes('localhost') || CONNECTION_STRING.includes('127.0.0.1');
    let clientOptions: any = {};
    if (isLocal) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        clientOptions = {
            connectionString: CONNECTION_STRING.replace('localhost', '127.0.0.1'),
            agent: new https.Agent({ rejectUnauthorized: false })
        };
    } else {
        clientOptions = { connectionString: CONNECTION_STRING };
    }

    const client = new CosmosClient(clientOptions);
    const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

    const targetId = "SC-2024-Fall-PM-1";
    console.log(`Checking ID: ${targetId}`);

    const { resource } = await container.item(targetId, "SC-2024-Fall-PM").read();

    if (!resource) {
        console.error("Item NOT FOUND in DB.");
    } else {
        console.log("Item Found!");
        console.log("Keys:", Object.keys(resource));

        if (resource.context) {
            console.log("Context Object Found.");
            console.log("Context Background Length:", resource.context.background?.length);
            console.log("Context Diagrams Count:", resource.context.diagrams?.length);

            if (resource.context.diagrams && resource.context.diagrams.length > 0) {
                console.log("First Diagram ID:", resource.context.diagrams[0].id);
                console.log("First Diagram Type:", resource.context.diagrams[0].type);
            }
        } else {
            console.error("Context Object MISSING!");
        }

        console.log("Questions Array Length:", resource.questions?.length);
    }
}

main().catch(console.error);
