import { CosmosClient } from '@azure/cosmos';

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || "";
const DATABASE_NAME = "pm-exam-dx-db";

if (!CONNECTION_STRING) {
    console.warn("COSMOS_DB_CONNECTION is not set. Database operations will fail.");
}

const client = new CosmosClient(CONNECTION_STRING);
const database = client.database(DATABASE_NAME);

export const containers = {
    questions: database.container("Questions"),
    users: database.container("Users"),
    accounts: database.container("Accounts"),
    sessions: database.container("Sessions"),
    learningRecords: database.container("LearningRecords"),
};

export const initDatabase = async () => {
    // Only for local dev / initialization
    const { database } = await client.databases.createIfNotExists({ id: DATABASE_NAME });

    // Create containers with PKs
    await database.containers.createIfNotExists({ id: "Questions", partitionKey: "/examId" });
    await database.containers.createIfNotExists({ id: "Users", partitionKey: "/id" });
    await database.containers.createIfNotExists({ id: "Accounts", partitionKey: "/userId" });
    await database.containers.createIfNotExists({ id: "Sessions", partitionKey: "/sessionToken" });
    await database.containers.createIfNotExists({ id: "LearningRecords", partitionKey: "/userId" });

    console.log("Database initialized");
};
