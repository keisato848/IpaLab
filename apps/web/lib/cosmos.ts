import { CosmosClient, Container } from '@azure/cosmos';
import * as https from 'https';
import { getAppInsightsClient } from '@/lib/appinsights';

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || "";
const DATABASE_NAME = "pm-exam-dx-db";

// Singleton instance
let client: CosmosClient | undefined;

// 初期化時にエラーを絶対に投げないように変更
const getClient = async (): Promise<CosmosClient | undefined> => {
    if (client) return client;

    // 接続文字列がない場合は、警告のみで undefined を返す（エラー終了させない）
    if (!CONNECTION_STRING) {
        console.warn("[Cosmos] Skipping DB initialization (No Connection String)");
        return undefined;
    }

    try {
        let connStr = CONNECTION_STRING;
        if (connStr.includes("localhost")) {
            connStr = connStr.replace("localhost", "127.0.0.1");
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }
        client = new CosmosClient({
            connectionString: connStr,
            agent: new https.Agent({ rejectUnauthorized: false })
        });
        return client;
    } catch (e) {
        console.error("[Cosmos] Client creation failed (ignoring for startup):", e);
        return undefined;
    }
};

const getDatabase = async () => {
    const c = await getClient();
    if (!c) return undefined; // クライアントがなければ undefined
    return c.database(DATABASE_NAME);
};

export const getContainer = async (name: string): Promise<Container | undefined> => {
    const db = await getDatabase();
    if (!db) {
        console.warn(`[Cosmos] Cannot get container '${name}' (DB not ready)`);
        return undefined; // エラーではなく undefined を返す
    }
    return db.container(name);
};

// Deprecated: Synchronous access is not supported with lazy initialization.
// Converting to async accessors or removing entirely.
// For backward compatibility during refactor, we remove it to force errors and fix them.
// export const containers = { ... } -> Removed

export const initDatabase = async () => {
    const c = await getClient();
    if (!c) {
        return;
    }
    const { database } = await c.databases.createIfNotExists({ id: DATABASE_NAME });

    // Create containers with PKs
    await database.containers.createIfNotExists({ id: "Questions", partitionKey: "/examId" });
    await database.containers.createIfNotExists({ id: "Users", partitionKey: "/id" });
    await database.containers.createIfNotExists({ id: "Accounts", partitionKey: "/userId" });
    await database.containers.createIfNotExists({ id: "Sessions", partitionKey: "/sessionToken" });
    await database.containers.createIfNotExists({ id: "LearningRecords", partitionKey: "/userId" });
    await database.containers.createIfNotExists({ id: "LearningSessions", partitionKey: "/userId" });
    await database.containers.createIfNotExists({ id: "Exams", partitionKey: "/id" });
    await database.containers.createIfNotExists({ id: "ExamProgress", partitionKey: "/userId" });
    await database.containers.createIfNotExists({ id: "Metrics", partitionKey: "/type" });
};

