import { CosmosClient, Container } from '@azure/cosmos';

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || "";
const DATABASE_NAME = "pm-exam-dx-db";

let client: CosmosClient | undefined;

try {
    if (CONNECTION_STRING) {
        console.log("Initializing Cosmos Client with string length:", CONNECTION_STRING.length);
        const options: any = { endpoint: CONNECTION_STRING };
        if (CONNECTION_STRING.includes("localhost") || CONNECTION_STRING.includes("127.0.0.1") || CONNECTION_STRING.includes("AccountKey")) {
            // Heuristic for Emulator or key-based connection string handling if needed
            // Actually, simply passing the connection string to constructor is usually enough, 
            // but for Emulator we might need to disable SSL verification node-side.
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }
        client = new CosmosClient(CONNECTION_STRING);
    } else {
        console.error("COSMOS_DB_CONNECTION is empty or undefined");
    }
} catch (e) {
    console.warn("Failed to init Cosmos Client:", e);
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

export const initDatabase = async () => {
    if (!client) {
        console.warn("Skipping DB init: No client");
        return;
    }
    const { database } = await client.databases.createIfNotExists({ id: DATABASE_NAME });

    // Create containers with PKs
    await database.containers.createIfNotExists({ id: "Questions", partitionKey: "/examId" });
    await database.containers.createIfNotExists({ id: "Users", partitionKey: "/id" });
    await database.containers.createIfNotExists({ id: "Accounts", partitionKey: "/userId" });
    await database.containers.createIfNotExists({ id: "Sessions", partitionKey: "/sessionToken" });
    await database.containers.createIfNotExists({ id: "LearningRecords", partitionKey: "/userId" });

    console.log("Database initialized");
};
