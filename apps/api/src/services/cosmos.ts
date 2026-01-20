import { CosmosClient, Container } from '@azure/cosmos';

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || "";
const DATABASE_NAME = "pm-exam-dx-db";

let client: CosmosClient | undefined;

// 遅延初期化のためのクライアント取得関数
const getClient = (): CosmosClient => {
    if (client) {
        return client;
    }
    if (!CONNECTION_STRING) {
        throw new Error("Cosmos DB not initialized (Check COSMOS_DB_CONNECTION)");
    }
    try {
        client = new CosmosClient(CONNECTION_STRING);
        return client;
    } catch (e) {
        console.error("Failed to create Cosmos Client:", e);
        throw new Error("Could not create Cosmos Client instance.");
    }
};

const getDatabase = () => {
    return getClient().database(DATABASE_NAME);
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
    try {
        const cosmosClient = getClient(); // ここで初めてクライアントが生成される可能性がある
        const { database } = await cosmosClient.databases.createIfNotExists({ id: DATABASE_NAME });

        // Create containers with PKs
        await database.containers.createIfNotExists({ id: "Questions", partitionKey: "/examId" });
        await database.containers.createIfNotExists({ id: "Users", partitionKey: "/id" });
        await database.containers.createIfNotExists({ id: "Accounts", partitionKey: "/userId" });
        await database.containers.createIfNotExists({ id: "Sessions", partitionKey: "/sessionToken" });
        await database.containers.createIfNotExists({ id: "LearningRecords", partitionKey: "/userId" });

        console.log("Database initialized");
    } catch (e) {
        // initDatabaseは主にデバッグ用のスクリプトから呼ばれるため、
        // 起動シーケンスをブロックしないようにエラーをログに記録するに留める。
        console.warn("Skipping DB init due to an error:", e);
    }
};
