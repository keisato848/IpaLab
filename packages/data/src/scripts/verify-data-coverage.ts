/**
 * verify-data-coverage.ts
 *
 * 目的:
 *   ローカルの問題データ (packages/data/data/questions/*) と CosmosDB の Questions
 *   コンテナを照合し、本番/ステージングへのデータ同期漏れを検出する。
 *
 *   Issue #208 のように "ローカルには JSON があるが Cosmos に未投入" のギャップを
 *   本番投入前に検出することを狙う。
 *
 * 使い方:
 *   1) 接続文字列を環境変数で指定 (apps/web/.env.local の COSMOS_DB_CONNECTION を流用)
 *   2) `npx tsx packages/data/src/scripts/verify-data-coverage.ts`
 *      - JSON 出力を希望する場合は `--json` を付与
 *      - 特定 examId のみ照合する場合は `--exam <examId>`
 *
 * 終了コード:
 *   - 0 : すべての試験が DB に存在し、件数 >= 1
 *   - 1 : ギャップ検出 (CI/CD で sync-db 後の検証ステップとして利用可)
 *   - 2 : 設定不備や接続失敗
 *
 * 注意:
 *   CosmosDB は Selected Networks 構成のため、実行元 IP が許可されている必要がある。
 *   CI/CD からの実行が難しい場合、リリース担当者がローカルで sync-db 直後に
 *   このスクリプトを手動実行することを想定している。
 */

import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

const possibleEnvPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
];
for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
}

const CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || process.env.Values_COSMOS_DB_CONNECTION;
const DATABASE_NAME = process.env.COSMOS_DB_NAME || 'pm-exam-dx-db';
const QUESTIONS_CONTAINER = 'Questions';

const QUESTIONS_DIR = path.resolve(__dirname, '../../data/questions');

interface CoverageRow {
    examId: string;
    localExists: boolean;
    localQuestionCount: number;
    dbQuestionCount: number;
    status: 'ok' | 'missing_in_db' | 'count_mismatch' | 'extra_in_db' | 'local_only' | 'db_only';
    note?: string;
}

function listLocalExamIds(): string[] {
    if (!fs.existsSync(QUESTIONS_DIR)) {
        console.error(`[verify] Local questions dir not found: ${QUESTIONS_DIR}`);
        return [];
    }
    return fs
        .readdirSync(QUESTIONS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
}

function countLocalQuestions(examId: string): number {
    const dir = path.join(QUESTIONS_DIR, examId);
    const transformed = path.join(dir, 'questions_transformed.json');
    const raw = path.join(dir, 'questions_raw.json');
    const file = fs.existsSync(transformed) ? transformed : fs.existsSync(raw) ? raw : null;
    if (!file) return 0;
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (Array.isArray(data)) return data.length;
        if (data && Array.isArray(data.questions)) return data.questions.length;
        // 単一大問オブジェクト形式 (qNo を持つ)
        if (data && typeof data === 'object' && 'qNo' in data) return 1;
        return 0;
    } catch (e) {
        console.warn(`[verify] Failed to parse ${file}: ${(e as Error).message}`);
        return 0;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes('--json');
    const examFilterIdx = args.indexOf('--exam');
    const examFilter = examFilterIdx >= 0 ? args[examFilterIdx + 1] : null;

    if (!CONNECTION_STRING) {
        console.error('[verify] COSMOS_DB_CONNECTION is not set. Provide via apps/web/.env.local or env var.');
        process.exit(2);
    }

    const isLocal = CONNECTION_STRING.includes('localhost') || CONNECTION_STRING.includes('127.0.0.1');
    const clientOptions: any = { connectionString: CONNECTION_STRING };
    if (isLocal) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        clientOptions.agent = new https.Agent({ rejectUnauthorized: false });
    }

    const client = new CosmosClient(clientOptions);
    const container = client.database(DATABASE_NAME).container(QUESTIONS_CONTAINER);

    // 1) DB 側: examId ごとの件数を集計
    const dbCounts = new Map<string, number>();
    try {
        const { resources } = await container.items
            .query<{ examId: string; total: number }>(
                'SELECT c.examId, COUNT(1) AS total FROM c GROUP BY c.examId'
            )
            .fetchAll();
        for (const row of resources) {
            dbCounts.set(row.examId, Number(row.total) || 0);
        }
    } catch (e) {
        console.error(`[verify] Cosmos query failed: ${(e as Error).message}`);
        process.exit(2);
    }

    // 2) ローカル側: 各 examId の件数を算出
    const localExamIds = listLocalExamIds();
    const allExamIds = new Set<string>([...localExamIds, ...dbCounts.keys()]);
    const targets = examFilter ? [examFilter] : Array.from(allExamIds).sort();

    const rows: CoverageRow[] = targets.map((examId) => {
        const localExists = localExamIds.includes(examId);
        const localCount = localExists ? countLocalQuestions(examId) : 0;
        const dbCount = dbCounts.get(examId) ?? 0;

        let status: CoverageRow['status'] = 'ok';
        let note: string | undefined;

        if (localExists && dbCount === 0) {
            status = 'missing_in_db';
            note = 'Local data exists but DB has 0 records. Run sync-db.';
        } else if (!localExists && dbCount > 0) {
            status = 'db_only';
            note = 'DB has records but no local data dir. Possibly orphaned.';
        } else if (localExists && localCount > 0 && dbCount > 0 && localCount !== dbCount) {
            // 大問数の不一致は階層化 (Hierarchical) の差異の可能性もあるため warn 扱い
            status = 'count_mismatch';
            note = `local=${localCount} vs db=${dbCount}`;
        } else if (localExists && localCount === 0) {
            status = 'local_only';
            note = 'Local dir found but JSON is empty/unreadable.';
        }

        return {
            examId,
            localExists,
            localQuestionCount: localCount,
            dbQuestionCount: dbCount,
            status,
            note,
        };
    });

    const problems = rows.filter((r) => r.status !== 'ok');

    if (jsonOutput) {
        console.log(JSON.stringify({ database: DATABASE_NAME, total: rows.length, problems: problems.length, rows }, null, 2));
    } else {
        console.log(`\n=== Data Coverage Report ===`);
        console.log(`Database: ${DATABASE_NAME}`);
        console.log(`Inspected: ${rows.length} examId(s) | Problems: ${problems.length}\n`);

        const header = ['examId', 'local', 'db', 'status', 'note'];
        const widths = [40, 6, 6, 18, 60];
        const fmt = (cols: string[]) =>
            cols.map((c, i) => c.padEnd(widths[i]).slice(0, widths[i])).join(' | ');
        console.log(fmt(header));
        console.log(widths.map((w) => '-'.repeat(w)).join('-+-'));
        for (const r of rows) {
            console.log(
                fmt([
                    r.examId,
                    String(r.localQuestionCount),
                    String(r.dbQuestionCount),
                    r.status,
                    r.note ?? '',
                ])
            );
        }

        if (problems.length > 0) {
            console.log(`\n[verify] FAIL: ${problems.length} examId(s) need attention. See rows above.`);
        } else {
            console.log(`\n[verify] OK: all examIds have non-zero questions in DB.`);
        }
    }

    process.exit(problems.length > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error('[verify] Unexpected failure:', e);
    process.exit(2);
});
