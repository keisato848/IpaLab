
const { CosmosClient } = require('@azure/cosmos');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

let CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || "";
if (CONNECTION_STRING.includes("localhost")) {
    console.log("Replacing localhost with 127.0.0.1");
    CONNECTION_STRING = CONNECTION_STRING.replace("localhost", "127.0.0.1");
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const DATABASE_NAME = "pm-exam-dx-db";

console.log(`Connection String Length: ${CONNECTION_STRING.length}`);
if (CONNECTION_STRING.length > 0) {
    const endpoint = CONNECTION_STRING.split(';').find(p => p.startsWith('AccountEndpoint='));
    console.log(`Endpoint: ${endpoint}`);
}

async function main() {
    try {
        const client = new CosmosClient(CONNECTION_STRING);
        const database = client.database(DATABASE_NAME);
        const container = database.container("Questions");

        console.log("Querying...");
        const { resources } = await container.items.query("SELECT TOP 1 * FROM c").fetchAll();
        console.log(`Success! Found ${resources.length} items.`);

        if (resources.length > 0) {
            console.log("Sample ID:", resources[0].id);
        }
    } catch (e) {
        console.error("Connection Failed:", e?.message);
        if (e && e.code) console.error("Code:", e.code);
    }
}

main();
