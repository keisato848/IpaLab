import { CosmosClient, Container } from "@azure/cosmos";
import * as https from "https";

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || "";
const DATABASE_NAME = "pm-exam-dx-db";

let client: CosmosClient | undefined;

const getClient = () => {
  if (client) return client;

  if (!CONNECTION_STRING) return undefined;

  try {
    let connStr = CONNECTION_STRING;
    if (connStr.includes("localhost")) {
      connStr = connStr.replace("localhost", "127.0.0.1");
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    client = new CosmosClient({
      connectionString: connStr,
      agent: new https.Agent({ rejectUnauthorized: false }),
    });
    return client;
  } catch (e) {
    console.error("Failed to init Cosmos Client:", e);
    return undefined;
  }
};

const getDatabase = () => {
  const c = getClient();
  if (!c)
    throw new Error("Cosmos DB not initialized (Check COSMOS_DB_CONNECTION)");
  return c.database(DATABASE_NAME);
};

const getContainer = (name: string): Container => {
  return getDatabase().container(name);
};

export const containers = {
  get questions() {
    return getContainer("Questions");
  },
  get users() {
    return getContainer("Users");
  },
  get accounts() {
    return getContainer("Accounts");
  },
  get sessions() {
    return getContainer("Sessions");
  },
  get learningSessions() {
    return getContainer("LearningSessions");
  },
  get learningRecords() {
    return getContainer("LearningRecords");
  },
  get exams() {
    return getContainer("Exams");
  },
  get examProgress() {
    return getContainer("ExamProgress");
  },
};

export const initDatabase = async () => {
  const c = getClient();
  if (!c) {
    return;
  }
  const { database } = await c.databases.createIfNotExists({
    id: DATABASE_NAME,
  });

  // Create containers with PKs
  await Promise.all([
    database.containers.createIfNotExists({
      id: "Questions",
      partitionKey: "/examId",
    }),
    database.containers.createIfNotExists({ id: "Users", partitionKey: "/id" }),
    database.containers.createIfNotExists({
      id: "Accounts",
      partitionKey: "/userId",
    }),
    database.containers.createIfNotExists({
      id: "Sessions",
      partitionKey: "/sessionToken",
    }),
    database.containers.createIfNotExists({
      id: "LearningRecords",
      partitionKey: "/userId",
    }),
    database.containers.createIfNotExists({
      id: "LearningSessions",
      partitionKey: "/userId",
    }),
    database.containers.createIfNotExists({ id: "Exams", partitionKey: "/id" }),
    database.containers.createIfNotExists({
      id: "ExamProgress",
      partitionKey: "/userId",
    }),
  ]);
};
