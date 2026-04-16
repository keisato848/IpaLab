import { CosmosClient, Container } from '@azure/cosmos';
import * as https from 'https';

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || "";
const DATABASE_NAME = "pm-exam-dx-db";
const CONTAINER_PARTITION_KEYS: Record<string, string> = {
    Questions: "/examId",
    Users: "/id",
    Accounts: "/userId",
    Sessions: "/sessionToken",
    LearningRecords: "/userId",
    LearningSessions: "/userId",
    Exams: "/id",
    ExamProgress: "/userId",
    Metrics: "/type",
    FeatureFlags: "/id",
    PageViews: "/date",
    AiAssistantUsage: "/userId",
    BugReports: "/userId",
};

// Singleton instance
let client: CosmosClient | undefined;

// Lazy initialization function
const getClient = async (): Promise<CosmosClient | undefined> => {
    if (client) {
        return client;
    }

    if (!CONNECTION_STRING) {
        // In build time or CI without secrets, this might fail if called.
        // We now return undefined to avoid crashing the build/startup.
        console.warn("[CosmosDB] No connection string found. DB access will be disabled.");
        return undefined;
    }

    try {
        let connStr = CONNECTION_STRING;
        const isLocalEmulator = connStr.includes("localhost") || connStr.includes("127.0.0.1");
        
        // Fix for local emulator
        if (connStr.includes("localhost")) {
            connStr = connStr.replace("localhost", "127.0.0.1");
        }

        // ローカルエミュレータの場合のみTLS検証を無効化
        // 本番環境（Azure CosmosDB）では適切な証明書が使用される
        if (isLocalEmulator) {
            // codeql[js/disabling-certificate-validation] - ローカルエミュレータ専用の意図的な無効化
            console.warn("[CosmosDB] ローカルエミュレータ接続: TLS証明書検証を無効化します（開発環境のみ）");
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            client = new CosmosClient({
                connectionString: connStr,
                // codeql[js/disabling-certificate-validation] - ローカルエミュレータ専用
                agent: new https.Agent({ rejectUnauthorized: false })
            });
        } else {
            // 本番環境: 標準のTLS検証を使用
            client = new CosmosClient({
                connectionString: connStr,
            });
        }

        return client;
    } catch (e: any) {
        console.error("Failed to create Cosmos Client (Web):", e);
        // Return undefined instead of throwing
        return undefined;
    }
};

const getDatabase = async () => {
    const c = await getClient();
    if (!c) return undefined;
    return c.database(DATABASE_NAME);
};

export const getContainer = async (name: string): Promise<Container | undefined> => {
    const db = await getDatabase();
    if (!db) return undefined;
    return db.container(name);
};

const isCosmosStatus = (error: unknown, expectedStatus: number) => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const maybeError = error as {
        code?: number | string;
        statusCode?: number;
        message?: string;
    };

    if (maybeError.statusCode === expectedStatus) {
        return true;
    }

    if (typeof maybeError.code === 'number' && maybeError.code === expectedStatus) {
        return true;
    }

    if (typeof maybeError.code === 'string' && maybeError.code === String(expectedStatus)) {
        return true;
    }

    if (!maybeError.message) {
        return false;
    }

    if (expectedStatus === 404) {
        return maybeError.message.includes('NotFound') || maybeError.message.includes('Resource Not Found');
    }

    if (expectedStatus === 409) {
        return maybeError.message.includes('Conflict') || maybeError.message.includes('already exists');
    }

    return false;
};

const containerCache = new Map<string, Container>();

export const ensureContainer = async (name: string): Promise<Container | undefined> => {
    const cached = containerCache.get(name);
    if (cached) return cached;

    const db = await getDatabase();
    if (!db) return undefined;

    const existingContainer = db.container(name);
    try {
        await existingContainer.read();
        containerCache.set(name, existingContainer);
        return existingContainer;
    } catch (error) {
        if (!isCosmosStatus(error, 404)) {
            throw error;
        }
    }

    const partitionKey = CONTAINER_PARTITION_KEYS[name];
    if (!partitionKey) {
        return existingContainer;
    }

    try {
        const { container } = await db.containers.create({
            id: name,
            partitionKey,
        });

        containerCache.set(name, container);
        return container;
    } catch (error) {
        if (isCosmosStatus(error, 409)) {
            containerCache.set(name, existingContainer);
            return existingContainer;
        }

        throw error;
    }
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
    await Promise.all(
        Object.entries(CONTAINER_PARTITION_KEYS).map(([id, partitionKey]) =>
            database.containers.createIfNotExists({ id, partitionKey })
        )
    );
};
