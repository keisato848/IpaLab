import { CosmosClient, Container } from '@azure/cosmos';
import { getAppInsightsClient } from '@/lib/appinsights';

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
    } catch (e: any) {
        console.error("Failed to create Cosmos Client (Web):", e);
        const aiClient = getAppInsightsClient();
        if (aiClient) {
            aiClient.trackException({ exception: e as Error });
        }
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
    get metrics() { return getContainer("Metrics"); },
};
