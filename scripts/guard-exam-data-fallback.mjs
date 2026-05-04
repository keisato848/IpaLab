#!/usr/bin/env node
/**
 * Guard: 午後試験データ表示の防壁が崩されていないかを検証する。
 *
 * 過去インシデント (PR #230 / SA-2024-Spring-PM1):
 *   1. 質問ページの filesystem fallback が `NODE_ENV !== 'production'` で本番無効化された
 *   2. next.config.js の outputFileTracingIncludes 不在で standalone bundle に
 *      packages/data の問題JSON が同梱されない
 *   3. 結果として Cosmos 同期漏れが起きると本番で「データが見つかりません」が表示
 *
 * このスクリプトは pre-commit / CI で実行され、再発を機械的に防ぐ。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const errors = [];
const warnings = [];

function read(rel) {
    const p = path.join(repoRoot, rel);
    if (!fs.existsSync(p)) {
        errors.push(`[MISSING] ${rel} が存在しません。`);
        return null;
    }
    return fs.readFileSync(p, 'utf8');
}

// --- Rule 1: NODE_ENV ガードを fallback の if 条件に再導入していないか ---
const examPages = [
    'apps/web/app/(main)/exam/[year]/[type]/[qNo]/page.tsx',
    'apps/web/app/(main)/exam/[year]/[type]/page.tsx',
];

for (const rel of examPages) {
    const src = read(rel);
    if (!src) continue;

    const forbiddenPattern =
        /process\.env\.NODE_ENV\s*!==?\s*['"]production['"][\s\S]{0,800}(getExamData|loadFilesystemQuestions)/;
    if (forbiddenPattern.test(src)) {
        errors.push(
            `[RULE-1] ${rel}: filesystem fallback を NODE_ENV ガードで本番無効化しています。\n` +
            '       Cosmos 同期漏れ時の最終防衛線が消えます。撤廃してください。\n' +
            '       参考: PR #230'
        );
    }

    if ((src.includes('getExamData') || src.includes('loadFilesystemQuestions')) && !/Filesystem fallback engaged/i.test(src)) {
        warnings.push(
            `[RULE-1b] ${rel}: fallback 発動時の warn ログ ("Filesystem fallback engaged") が見当たりません。\n` +
            '         Cosmos 同期漏れの観測性が低下します。'
        );
    }
}

// --- Rule 2: next.config.js が packages/data の JSON を standalone に含めているか ---
const nextConfig = read('apps/web/next.config.js');
if (nextConfig) {
    const hasTracing = /(?<![A-Za-z_])outputFileTracingIncludes\s*:/.test(nextConfig);
    const hasDataGlob = /packages\/data\/data\/questions\/\*\*/.test(nextConfig);
    if (!hasTracing || !hasDataGlob) {
        errors.push(
            '[RULE-2] apps/web/next.config.js: outputFileTracingIncludes に\n' +
            "       'packages/data/data/questions/**/*.json' を含めてください。\n" +
            '       これがないと standalone build に問題JSONが同梱されず、本番で fallback が動作しません。\n' +
            '       参考: PR #230'
        );
    }
}

// --- Rule 3: ssg-helper の getExamData が壊れていないか ---
const ssgHelper = read('apps/web/lib/ssg-helper.ts');
if (ssgHelper && !/export\s+async\s+function\s+getExamData\s*\(/.test(ssgHelper)) {
    errors.push(
        '[RULE-3] apps/web/lib/ssg-helper.ts: getExamData() のエクスポートが見つかりません。\n' +
        '       fallback の入口が消えています。'
    );
}

// --- Report ---
if (warnings.length > 0) {
    console.warn('\n⚠️  Exam-data fallback guard warnings:\n');
    warnings.forEach((w) => console.warn('  ' + w + '\n'));
}

if (errors.length > 0) {
    console.error('\n❌ Exam-data fallback guard FAILED:\n');
    errors.forEach((e) => console.error('  ' + e + '\n'));
    console.error(
        '対応方法: .github/copilot-instructions.md の\n' +
        '「午後試験データ防壁 (Exam Data Fallback Guard)」セクションを参照してください。\n'
    );
    process.exit(1);
}

console.log('✅ Exam-data fallback guard: OK');
