
import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as https from 'https';
import fs from 'fs';

const possibleEnvPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
];

for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
}

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || process.env.Values_COSMOS_DB_CONNECTION || "";
const DATABASE_NAME = "pm-exam-dx-db";
const EXAM_CONTAINER_NAME = "Exams";

async function main() {
    if (!CONNECTION_STRING) {
        console.error("No Connection String found");
        return;
    }

    const isLocal = CONNECTION_STRING.includes('localhost') || CONNECTION_STRING.includes('127.0.0.1');
    let clientOptions: any = { connectionString: CONNECTION_STRING };
    if (isLocal) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        let finalConn = CONNECTION_STRING;
        if (CONNECTION_STRING.includes('localhost')) finalConn = CONNECTION_STRING.replace('localhost', '127.0.0.1');
        clientOptions = {
            connectionString: finalConn,
            agent: new https.Agent({ rejectUnauthorized: false })
        };
    }

    const client = new CosmosClient(clientOptions);
    const container = client.database(DATABASE_NAME).container(EXAM_CONTAINER_NAME);

    console.log("Fetching Exams from DB...");
    const { resources: exams } = await container.items
        .query("SELECT c.id, c.title, c.category FROM c")
        .fetchAll();

    const stats: Record<string, { AM: number; PM: number; Total: number; Years: Set<string> }> = {
        FE: { AM: 0, PM: 0, Total: 0, Years: new Set() },
        AP: { AM: 0, PM: 0, Total: 0, Years: new Set() },
        PM: { AM: 0, PM: 0, Total: 0, Years: new Set() }, // PM category (Project Manager)
    };
    const otherStats = { Total: 0 };

    const details: string[] = [];

    exams.forEach(e => {
        let type = e.category;
        // Map category if needed, assuming 'FE', 'AP', 'PM' are the keys used in DB
        // Based on previous files, 'SG' is also a type, but user asked for FE, AP, PM. (PM here means Project Manager category)

        if (!stats[type]) {
            otherStats.Total++;
            return;
        }

        stats[type].Total++;

        // Parse ID for year: e.g., AP-2024-Spring-AM
        const parts = e.id.split('-');
        if (parts.length >= 2 && !isNaN(parseInt(parts[1]))) {
            stats[type].Years.add(parts[1]);
        }

        // Determine AM/PM
        if (e.id.includes('AM')) stats[type].AM++;
        else if (e.id.includes('PM') || e.title.includes('午後')) stats[type].PM++;

        details.push(`[${type}] ${e.id}`);
    });

    console.log("\nDATA REGISTRATION REPORT (DB):");
    console.log("--------------------------------------------------");
    console.log("FE (基本情報):");
    console.log(`  - Total: ${stats.FE.Total}`);
    console.log(`  - AM: ${stats.FE.AM}, PM: ${stats.FE.PM}`);
    console.log(`  - Years: ${Array.from(stats.FE.Years).sort().join(', ')}`);
    console.log("AP (応用情報):");
    console.log(`  - Total: ${stats.AP.Total}`);
    console.log(`  - AM: ${stats.AP.AM}, PM: ${stats.AP.PM}`);
    console.log(`  - Years: ${Array.from(stats.AP.Years).sort().join(', ')}`);
    console.log("PM (プロマネ):");
    console.log(`  - Total: ${stats.PM.Total}`);
    console.log(`  - AM: ${stats.PM.AM}, PM: ${stats.PM.PM}`);
    console.log(`  - Years: ${Array.from(stats.PM.Years).sort().join(', ')}`);
    console.log("--------------------------------------------------");

    // Local check (simple fs list)
    const dataDir = path.resolve(__dirname, '../../data/questions');
    if (fs.existsSync(dataDir)) {
        const folders = fs.readdirSync(dataDir);
        console.log("\nLOCAL EXTRACTION REPORT (Filesystem):");
        console.log(`Total Exam Folders: ${folders.length}`);

        const localStats = { FE: 0, AP: 0, PM: 0 };
        folders.forEach(f => {
            if (f.startsWith('FE')) localStats.FE++;
            if (f.startsWith('AP')) localStats.AP++;
            if (f.startsWith('PM')) localStats.PM++;
        });
        console.log(`Folder Counts -> FE: ${localStats.FE}, AP: ${localStats.AP}, PM: ${localStats.PM}`);
    }
}

main().catch(console.error);
