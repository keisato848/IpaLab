import fs from 'fs/promises';
import path from 'path';

/**
 * CLIオプションを解析する
 */
function parseArgs(): { filter?: string; force: boolean; dryRun: boolean } {
    const args = process.argv.slice(2);
    let filter: string | undefined;
    let force = false;
    let dryRun = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--filter' && args[i + 1]) {
            filter = args[i + 1];
            i++;
        } else if (args[i] === '--force') {
            force = true;
        } else if (args[i] === '--dry-run') {
            dryRun = true;
        }
    }

    return { filter, force, dryRun };
}

/**
 * 午後問題ディレクトリかどうかを判定
 * PM1/PM2/PM ディレクトは Transform スクリプトで処理するため除外
 */
function isPMDirectory(dirName: string): boolean {
    return /-(PM\d?|PM)$/.test(dirName);
}

/**
 * questions_raw.json から問題配列を取得する
 * 形式1: 配列 [{qNo, text, options, ...}, ...]
 * 形式2: オブジェクト { "questions": [{qNo, text, options, correctOption, explanation, ...}, ...] }
 * 形式3: 午後問題形式 { qNo, theme, description, questions: [...] } → 除外対象
 */
function extractQuestions(raw: any): { questions: any[]; embedded: boolean } | null {
    if (Array.isArray(raw)) {
        return { questions: raw, embedded: false };
    }
    if (typeof raw === 'object' && raw !== null) {
        // 午後問題形式（theme/description がある）は除外
        if (raw.theme || raw.description) {
            return null;
        }
        // { "questions": [...] } 形式（AM2等）
        if (Array.isArray(raw.questions)) {
            // 各問題に correctOption が含まれているか確認（内蔵形式）
            const hasCorrectOption = raw.questions.length > 0 && raw.questions[0].correctOption !== undefined;
            return { questions: raw.questions, embedded: hasCorrectOption };
        }
    }
    return null;
}

async function main() {
    const { filter, force, dryRun } = parseArgs();
    const rawDir = path.resolve(__dirname, '../../data/questions');

    console.log(`=== gemini-import バッチ処理 ===`);
    if (filter) console.log(`フィルタ: ${filter}`);
    if (force) console.log(`強制モード: 既存ファイルを上書き`);
    if (dryRun) console.log(`ドライラン: ファイル書き込みなし`);

    // Read all directories in questions/
    const dirs = (await fs.readdir(rawDir)).sort();

    let totalImported = 0;
    let totalSkipped = 0;
    let totalDirs = 0;

    for (const examId of dirs) {
        // Skip if not a directory or hidden
        const examDir = path.join(rawDir, examId);
        const stats = await fs.stat(examDir);
        if (!stats.isDirectory()) continue;

        // 午後問題ディレクトリはスキップ（transform-batch-all-pm.ts で処理）
        if (isPMDirectory(examId)) {
            continue;
        }

        // フィルタオプション - 部分一致または正規表現
        if (filter && !examId.includes(filter) && !new RegExp(filter).test(examId)) {
            continue;
        }

        try {
            const questionsPath = path.join(examDir, 'questions_raw.json');

            // questions_raw.json の存在確認
            try {
                await fs.access(questionsPath);
            } catch {
                continue;
            }

            const questionsRaw = await fs.readFile(questionsPath, 'utf-8');
            const rawData = JSON.parse(questionsRaw);

            // 問題配列を取得（午後問題形式の場合はnullが返る）
            const extracted = extractQuestions(rawData);
            if (!extracted || extracted.questions.length === 0) {
                continue;
            }

            const { questions, embedded } = extracted;

            // answers_raw.json は内蔵形式でなければ必須
            let answers: any = {};
            if (!embedded) {
                const answersPath = path.join(examDir, 'answers_raw.json');
                try {
                    await fs.access(answersPath);
                    const answersRaw = await fs.readFile(answersPath, 'utf-8');
                    answers = JSON.parse(answersRaw);
                } catch {
                    console.log(`  ${examId}: answers_raw.json がないためスキップ`);
                    continue;
                }
            }

            // 既存q*.jsonファイル数を確認
            const existingFiles = await fs.readdir(examDir);
            const qFiles = existingFiles.filter(f => /^q\d+\.json$/.test(f));

            // --force でなく、既存ファイル数が一致していればスキップ
            if (!force && qFiles.length >= questions.length) {
                continue;
            }

            totalDirs++;
            const missing = questions.length - qFiles.length;

            if (dryRun) {
                console.log(`[DRY-RUN] ${examId}: raw=${questions.length}問, 既存q*.json=${qFiles.length}, 不足=${missing}${embedded ? ' (内蔵形式)' : ''}`);
                totalImported += missing;
                continue;
            }

            console.log(`Processing ${examId} (raw=${questions.length}, existing=${qFiles.length})${embedded ? ' [内蔵形式]' : ''}...`);

            // Load Explanations (Optional - 非内蔵形式の場合のみ)
            let explanations: any = {};
            if (!embedded) {
                try {
                    const expContent = await fs.readFile(path.join(examDir, 'explanations_raw.json'), 'utf-8');
                    explanations = JSON.parse(expContent);
                } catch (e) {
                    // Ignore if missing, use empty
                }
            }

            let importedCount = 0;
            let skippedCount = 0;
            for (const q of questions) {
                const qNo = q.qNo;
                const outFile = path.join(examDir, `q${qNo}.json`);

                // --force でなく既存ファイルがある場合はスキップ（個別ファイル単位）
                if (!force) {
                    try {
                        await fs.access(outFile);
                        skippedCount++;
                        continue;
                    } catch {
                        // ファイルが存在しない場合は生成する
                    }
                }

                let finalObj: any;

                if (embedded) {
                    // 内蔵形式（AM2等）: correctOption, explanation が既にraw内にある
                    finalObj = {
                        id: `${examId}-${qNo}`,
                        qNo: qNo,
                        text: q.text,
                        options: q.options,
                        correctOption: q.correctOption || null,
                        explanation: q.explanation || "",
                        examId: examId,
                        category: q.category || null,
                        subCategory: q.subCategory || null
                    };
                } else {
                    // 分離形式（AM等）: 解説優先順位:
                    // 1. questions_raw.json 内の explanation（fill-missing-explanations で生成済み）
                    // 2. explanations_raw.json の解説
                    // 3. 空文字
                    const correctOption = answers[String(qNo)];
                    const explanation = q.explanation || explanations[String(qNo)] || "";

                    finalObj = {
                        id: `${examId}-${qNo}`,
                        qNo: qNo,
                        text: q.text,
                        options: q.options,
                        correctOption: correctOption || null,
                        explanation: explanation,
                        examId: examId,
                        category: q.category,
                        subCategory: q.subCategory
                    };
                }

                // Save as q{No}.json
                await fs.writeFile(outFile, JSON.stringify(finalObj, null, 2));
                importedCount++;
            }
            totalImported += importedCount;
            totalSkipped += skippedCount;
            console.log(`  → ${examId}: ${importedCount}問生成, ${skippedCount}問スキップ`);

        } catch (e) {
            console.error(`Error importing ${examId}:`, e);
        }
    }

    console.log(`\n=== 完了 ===`);
    console.log(`対象ディレクトリ: ${totalDirs}`);
    console.log(`生成問題数: ${totalImported}`);
    console.log(`スキップ問題数: ${totalSkipped}`);
}

if (require.main === module) {
    main();
}
