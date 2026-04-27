// Self-test for guard-exam-data-fallback.mjs
// Mutates files in-memory only (writes, runs guard, reverts).
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function runGuard() {
    const r = spawnSync('node', ['scripts/guard-exam-data-fallback.mjs'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    return r.status;
}

function withMutation(file, transform, label) {
    const abs = path.join(repoRoot, file);
    const orig = fs.readFileSync(abs, 'utf8');
    const mutated = transform(orig);
    if (mutated === orig) throw new Error(`mutation no-op: ${label}`);
    fs.writeFileSync(abs, mutated);
    try {
        return runGuard();
    } finally {
        fs.writeFileSync(abs, orig);
    }
}

let pass = 0, fail = 0;
function expect(label, actual, expected) {
    if (actual === expected) { console.log(`  ✅ ${label}`); pass++; }
    else { console.log(`  ❌ ${label} (got=${actual}, expected=${expected})`); fail++; }
}

console.log('=== Baseline ===');
expect('clean repo passes', runGuard(), 0);

console.log('\n=== RULE-1 (NODE_ENV guard) ===');
expect(
    'qNo page: re-introduce NODE_ENV guard around fallback',
    withMutation(
        'apps/web/app/(main)/exam/[year]/[type]/[qNo]/page.tsx',
        (s) => s.replace(
            /if \(questions\.length === 0\) \{\s*\n\s*try \{\s*\n\s*const fsData = await getExamData/,
            "if (questions.length === 0 && process.env.NODE_ENV !== 'production') {\n        try {\n            const fsData = await getExamData"
        ),
        'NODE_ENV guard re-add'
    ),
    1
);

console.log('\n=== RULE-2 (outputFileTracingIncludes) ===');
expect(
    'next.config: rename outputFileTracingIncludes key',
    withMutation(
        'apps/web/next.config.js',
        (s) => s.replace('outputFileTracingIncludes:', 'DISABLED_KEY:'),
        'rename key'
    ),
    1
);
expect(
    'next.config: remove glob path',
    withMutation(
        'apps/web/next.config.js',
        (s) => s.replace(/packages\/data\/data\/questions\/\*\*\/\*\.json/g, 'other/dummy/**/*.json'),
        'remove glob'
    ),
    1
);

console.log('\n=== RULE-3 (getExamData export) ===');
expect(
    'ssg-helper: rename getExamData',
    withMutation(
        'apps/web/lib/ssg-helper.ts',
        (s) => s.replace('export async function getExamData(', 'export async function getExamDataRenamed('),
        'rename getExamData'
    ),
    1
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
