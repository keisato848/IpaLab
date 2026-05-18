#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(webRoot, '../..');
const testRoot = path.join(webRoot, '__tests__');
const pool = process.env.VITEST_POOL ?? 'threads';
const vitestBin = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'vitest.cmd' : 'vitest'
);

const batchSize = Math.max(1, Number.parseInt(process.env.VITEST_BATCH_SIZE ?? '4', 10));
const maxWorkers = Math.max(1, Number.parseInt(process.env.VITEST_MAX_WORKERS ?? '4', 10));

function collectTestFiles(dir) {
    const entries = readdirSync(dir).sort((a, b) => a.localeCompare(b));
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
            files.push(...collectTestFiles(fullPath));
            continue;
        }
        if (/\.(test|spec)\.(js|mjs|cjs|ts|mts|cts|jsx|tsx)$/.test(entry)) {
            files.push(path.relative(webRoot, fullPath).replace(/\\/g, '/'));
        }
    }

    return files;
}

const testFiles = collectTestFiles(testRoot);

if (testFiles.length === 0) {
    console.error('[vitest-batches] No test files found.');
    process.exit(1);
}

const totalBatches = Math.ceil(testFiles.length / batchSize);

function runVitest(files, label, workers) {
    console.log(
        `\n[vitest-batches] ${label}: ${files.length} file(s), pool=${pool}, maxWorkers=${workers}`
    );

    const result = spawnSync(
        vitestBin,
        ['run', ...files, `--pool=${pool}`, `--maxWorkers=${workers}`],
        {
            cwd: webRoot,
            env: {
                ...process.env,
                VITEST_MAX_WORKERS: String(workers),
            },
            stdio: 'inherit',
        }
    );

    if (result.error) {
        console.error(`[vitest-batches] Failed to run ${label}:`, result.error);
        return { ok: false, status: 1 };
    }

    return { ok: result.status === 0, status: result.status ?? 1 };
}

for (let offset = 0; offset < testFiles.length; offset += batchSize) {
    const batch = testFiles.slice(offset, offset + batchSize);
    const batchNo = offset / batchSize + 1;
    const workersForBatch = Math.min(maxWorkers, batch.length);

    const result = runVitest(batch, `Batch ${batchNo}/${totalBatches}`, workersForBatch);
    if (result.ok) {
        continue;
    }

    if (batch.length === 1) {
        process.exit(result.status);
    }

    console.warn(
        `[vitest-batches] Batch ${batchNo}/${totalBatches} failed; retrying files individually with maxWorkers=1.`
    );

    for (const file of batch) {
        const retry = runVitest([file], `Batch ${batchNo}/${totalBatches} retry: ${file}`, 1);
        if (!retry.ok) {
            process.exit(retry.status);
        }
    }
}

console.log(`\n[vitest-batches] Completed ${testFiles.length} test file(s).`);