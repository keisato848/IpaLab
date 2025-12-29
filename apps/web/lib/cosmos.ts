import { CosmosClient, Container } from '@azure/cosmos';

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || "";
const DATABASE_NAME = "pm-exam-dx-db";

let client: CosmosClient | undefined;

try {
    if (CONNECTION_STRING) {
        client = new CosmosClient(CONNECTION_STRING);
    }
} catch (e) {
    console.warn("Failed to init Cosmos Client (Web):", e);
}

const getDatabase = () => {
    if (!client) throw new Error("Cosmos DB not initialized (Check COSMOS_DB_CONNECTION)");
    return client.database(DATABASE_NAME);
};

const getContainer = (name: string): Container => {
    return getDatabase().container(name);
};

export const containers = {
    get questions() { return getContainer("Questions"); },
    get users() { return getContainer("Users"); },
    get accounts() { return getContainer("Accounts"); },
    get sessions() { return getContainer("Sessions"); },
    get learningRecords() { return getContainer("LearningRecords"); },
};
