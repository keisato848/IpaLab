
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../data/questions');

function getSortKey(dir: string) {
    // AP-2024-Spring-AM -> 2024-Sprint-AM
    // We want newest first.
    const parts = dir.split('-');
    const year = parseInt(parts[1]);
    const isSpring = parts[2] === 'Spring';
    // Fall (Oct) > Spring (Apr)
    return year * 10 + (isSpring ? 0 : 5);
}

function main() {
    console.log("Importing explanations from q*.json files...");

    const dirs = fs.readdirSync(DATA_DIR).filter(d =>
        d.startsWith('AP-') && d.endsWith('AM')
    );

    // Sort newest
    dirs.sort((a, b) => getSortKey(b) - getSortKey(a));

    let totalImported = 0;

    for (const dir of dirs) {
        const examDir = path.join(DATA_DIR, dir);
        const files = fs.readdirSync(examDir).filter(f => f.match(/^q\d+\.json$/));

        if (files.length === 0) continue;

        console.log(`Processing ${dir} (${files.length} individual files)...`);

        // Load Target (Transformed preferred for SSG)
        const transformedPath = path.join(examDir, 'questions_transformed.json');
        const rawPath = path.join(examDir, 'questions_raw.json');

        // We want to update BOTH if possible, but definitely Transformed.
        // If Transformed missing, create it from Raw? No, SSG helper fallback handles Raw.
        // But if raw is lacking fields, and we only update Raw, SSG picks it up.
        // If Transformed exists, we update it.

        let targets = [];
        if (fs.existsSync(transformedPath)) targets.push(transformedPath);
        if (fs.existsSync(rawPath)) targets.push(rawPath);

        if (targets.length === 0) {
            console.warn(`  No target JSON found for ${dir}`);
            continue;
        }

        // Load Maps
        const explanationMap = new Map<number, string>();
        const answerMap = new Map<number, string>();

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(examDir, file), 'utf-8');
                const qData = JSON.parse(content);
                const qNo = qData.qNo;
                if (qData.explanation) explanationMap.set(qNo, qData.explanation);
                if (qData.correctOption) answerMap.set(qNo, qData.correctOption);
            } catch (e) { }
        }

        let examImportCount = 0;

        for (const targetFile of targets) {
            try {
                const content = fs.readFileSync(targetFile, 'utf-8');
                let data = JSON.parse(content);
                let questions = Array.isArray(data) ? data : (data.questions || []);
                let modified = false;

                questions.forEach((q: any) => {
                    const qNo = q.qNo;
                    if (explanationMap.has(qNo)) {
                        if (!q.explanation || q.explanation.length < 10) {
                            q.explanation = explanationMap.get(qNo);
                            modified = true;
                            if (targetFile.includes('transformed')) examImportCount++;
                        }
                    }
                    if (answerMap.has(qNo)) {
                        if (!q.correctOption) {
                            q.correctOption = answerMap.get(qNo);
                            modified = true;
                        }
                    }
                });

                if (modified) {
                    // Preserve structure
                    if (Array.isArray(data)) {
                        data = questions;
                    } else {
                        data.questions = questions;
                    }
                    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2));
                    console.log(`  Updated ${path.basename(targetFile)}`);
                }
            } catch (e) {
                console.error(`  Error updating ${targetFile}:`, e);
            }
        }

        if (examImportCount > 0) {
            console.log(`  Imported ${examImportCount} explanations for ${dir}`);
            totalImported += examImportCount;
        }
    }

    console.log(`\nDone. Total Explanations Imported: ${totalImported}`);
}

main();
