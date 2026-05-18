import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

const DEFAULT_EMULATOR_KEY = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
const DATABASE_NAME = 'pm-exam-dx-db';
const CONFIGURED_READY_URL = process.env.COSMOS_EMULATOR_READY_URL || '';
const MAX_ATTEMPTS = Number.parseInt(process.env.COSMOS_EMULATOR_READY_ATTEMPTS || '60', 10);
const INTERVAL_MS = Number.parseInt(process.env.COSMOS_EMULATOR_READY_INTERVAL_MS || '5000', 10);
const LOCAL_EMULATOR_HOSTS = (process.env.COSMOS_EMULATOR_HOSTS || '')
    .split(',')
    .map(host => host.trim())
    .filter(Boolean);
const DEFAULT_EMULATOR_HOSTS = ['127.0.0.1', 'localhost', 'host.docker.internal', 'gateway.docker.internal'];
type EmulatorDetection = {
    host: string;
    probe: string;
    via: 'ready' | 'gateway';
};

const CONTAINER_PARTITION_KEYS: Record<string, string> = {
    Questions: '/examId',
    Users: '/id',
    Accounts: '/userId',
    Sessions: '/sessionToken',
    LearningRecords: '/userId',
    LearningSessions: '/userId',
    DailyProgress: '/userId',
    StudyPlan: '/userId',
    Exams: '/id',
    ExamProgress: '/userId',
    Metrics: '/type',
    FeatureFlags: '/id',
    PageViews: '/date',
    AiAssistantUsage: '/userId',
    BugReports: '/userId',
    PlanJobs: '/userId',
};

const possibleEnvPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
    path.resolve(__dirname, '../../.env'),
];

function sleep(ms: number) {
    return new Promise(resolveSleep => setTimeout(resolveSleep, ms));
}

function loadEnvFiles() {
    for (const envPath of possibleEnvPaths) {
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath, override: false });
            console.log(`[cosmos-verify] env を読み込みました: ${path.relative(process.cwd(), envPath)}`);
        }
    }
}

function isLocalConnection(connectionString: string) {
    return ['localhost', '127.0.0.1', 'host.docker.internal', 'gateway.docker.internal'].some(host =>
        connectionString.includes(host)
    );
}

function normalizeLocalConnection(connectionString: string) {
    return connectionString.replace('localhost', '127.0.0.1');
}

function redactConnectionString(connectionString: string) {
    return connectionString.replace(/AccountKey=[^;]+/i, 'AccountKey=[redacted]');
}

function extractAccountEndpoint(connectionString: string) {
    const match = connectionString.match(/AccountEndpoint=([^;]+)/i);
    return match?.[1] || null;
}

function extractEndpointHost(connectionString: string) {
    const endpoint = extractAccountEndpoint(connectionString);
    if (!endpoint) {
        return null;
    }

    try {
        return new URL(endpoint).hostname;
    } catch {
        return null;
    }
}

function rewriteConnectionHost(connectionString: string, host: string) {
    const endpoint = extractAccountEndpoint(connectionString);
    if (!endpoint) {
        return connectionString;
    }

    try {
        const url = new URL(endpoint);
        url.hostname = host;
        url.port = '8081';
        return connectionString.replace(endpoint, url.toString());
    } catch {
        return connectionString;
    }
}

function buildDefaultConnectionString(host: string) {
    return `AccountEndpoint=https://${host}:8081/;AccountKey=${DEFAULT_EMULATOR_KEY};`;
}

async function isReadyUrlReachable(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function isGatewayReachable(host: string) {
    return await new Promise<boolean>(resolve => {
        const request = https.request(
            {
                host,
                port: 8081,
                path: '/',
                method: 'GET',
                rejectUnauthorized: false,
            },
            response => {
                response.resume();
                resolve(Boolean(response.statusCode));
            }
        );

        request.on('error', () => resolve(false));
        request.setTimeout(3000, () => {
            request.destroy();
            resolve(false);
        });
        request.end();
    });
}

async function detectReachableEmulatorHost(preferredHost?: string | null): Promise<EmulatorDetection | null> {
    if (CONFIGURED_READY_URL) {
        console.log(`[cosmos-verify] 指定された readiness URL を確認します: ${CONFIGURED_READY_URL}`);
        if (await isReadyUrlReachable(CONFIGURED_READY_URL)) {
            return {
                host: new URL(CONFIGURED_READY_URL).hostname,
                probe: CONFIGURED_READY_URL,
                via: 'ready' as const,
            };
        }
    }

    const candidateHosts = Array.from(
        new Set([preferredHost, ...LOCAL_EMULATOR_HOSTS, ...DEFAULT_EMULATOR_HOSTS].filter(Boolean))
    ) as string[];

    for (const host of candidateHosts) {
        const readyUrl = `http://${host}:8080/ready`;
        console.log(`[cosmos-verify] Cosmos DB Emulator の readiness を確認します: ${readyUrl}`);
        if (await isReadyUrlReachable(readyUrl)) {
            return { host, probe: readyUrl, via: 'ready' as const };
        }

        if (await isGatewayReachable(host)) {
            return { host, probe: `https://${host}:8081/`, via: 'gateway' as const };
        }
    }

    return null;
}

async function waitForEmulator(preferredHost?: string | null) {
    let lastDetection: EmulatorDetection | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const detection = await detectReachableEmulatorHost(preferredHost);
        if (detection) {
            lastDetection = detection;
            if (detection.via === 'ready') {
                console.log(`[cosmos-verify] Cosmos DB Emulator は ready です: ${detection.probe}`);
            } else {
                console.log(`[cosmos-verify] readiness endpoint は未公開ですが gateway に到達できました: ${detection.probe}`);
            }
            return detection;
        }

        if (attempt < MAX_ATTEMPTS) {
            await sleep(INTERVAL_MS);
        }
    }

    if (CONFIGURED_READY_URL) {
        throw new Error(`Cosmos DB Emulator が ready/gateway になりませんでした: ${CONFIGURED_READY_URL}`);
    }

    throw new Error(
        `Cosmos DB Emulator が ready/gateway になりませんでした。試行ホスト: ${[
            preferredHost,
            ...LOCAL_EMULATOR_HOSTS,
            ...DEFAULT_EMULATOR_HOSTS,
        ]
            .filter(Boolean)
            .join(', ')}`
    );
}

async function verifyReadWrite(client: CosmosClient) {
    const container = client.database(DATABASE_NAME).container('Metrics');
    const id = `local-cosmos-verify-${Date.now()}`;
    const item = {
        id,
        type: 'local-cosmos-verify',
        timestamp: new Date().toISOString(),
        source: 'packages/data/src/scripts/verify-local-cosmos.ts',
    };

    await container.items.upsert(item);
    const { resource } = await container.item(id, item.type).read();

    if (!resource || resource.id !== id) {
        throw new Error('疎通確認用 item の読み戻しに失敗しました。');
    }

    await container.item(id, item.type).delete();
    console.log('[cosmos-verify] Metrics コンテナで write/read/delete を確認しました。');
}

async function main() {
    loadEnvFiles();

    const configuredConnection = process.env.COSMOS_DB_CONNECTION || process.env.Values_COSMOS_DB_CONNECTION;
    const connectionString = configuredConnection || '';

    if (configuredConnection && !isLocalConnection(connectionString)) {
        console.error('[cosmos-verify] 中止: このスクリプトはローカル Cosmos DB Emulator 専用です。');
        console.error(`[cosmos-verify] 検出した接続先: ${redactConnectionString(connectionString).split(';')[0]}`);
        process.exit(1);
    }

    const preferredHost = configuredConnection ? extractEndpointHost(configuredConnection) : null;
    const detection = await waitForEmulator(preferredHost);
    const baseConnectionString = configuredConnection || buildDefaultConnectionString(detection.host);
    const finalConnectionString = normalizeLocalConnection(rewriteConnectionHost(baseConnectionString, detection.host));

    console.log(`[cosmos-verify] 接続文字列: ${redactConnectionString(finalConnectionString)}`);

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const client = new CosmosClient({
        connectionString: finalConnectionString,
        agent: new https.Agent({ rejectUnauthorized: false }),
    } as any);

    const { database } = await client.databases.createIfNotExists({ id: DATABASE_NAME });
    console.log(`[cosmos-verify] Database を確認しました: ${DATABASE_NAME}`);

    for (const [id, partitionKey] of Object.entries(CONTAINER_PARTITION_KEYS)) {
        await database.containers.createIfNotExists({ id, partitionKey });
        console.log(`[cosmos-verify] Container OK: ${id} (${partitionKey})`);
    }

    await verifyReadWrite(client);
    console.log('[cosmos-verify] ローカル Cosmos DB 検証環境は利用可能です。');
}

main().catch(error => {
    console.error('[cosmos-verify] 検証に失敗しました。');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
