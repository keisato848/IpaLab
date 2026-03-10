/**
 * 午前問題の再抽出スクリプト
 * 欠損問題があるquestions_raw.jsonをGemini APIで再抽出し、
 * 既存データの良い部分を保持しつつ欠損分を補完する。
 *
 * 使い方:
 *   npx ts-node src/scripts/re-extract-am.ts --filter AP-2016-Spring-AM
 *   npx ts-node src/scripts/re-extract-am.ts  # 全欠損を処理
 *   npx ts-node src/scripts/re-extract-am.ts --dry-run  # 実行確認のみ
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// 環境変数読み込み
const envPaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env')
];
envPaths.forEach(envPath => dotenv.config({ path: envPath }));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません');

// 対象の欠損ディレクトリとその期待問題数
const TARGETS = [
    { examId: 'AP-2016-Spring-AM', expected: 80 },
    { examId: 'AP-2019-Fall-AM', expected: 80 },
    { examId: 'AP-2023-Fall-AM', expected: 80 },
];

function parseArgs() {
    const args = process.argv.slice(2);
    let filter: string | undefined;
    let dryRun = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--filter' && args[i + 1]) { filter = args[i + 1]; i++; }
        if (args[i] === '--dry-run') dryRun = true;
    }
    return { filter, dryRun };
}

async function uploadAndExtract(pdfPath: string, promptText: string): Promise<any[]> {
    const fileManager = new GoogleAIFileManager(apiKey!);
    const genAI = new GoogleGenerativeAI(apiKey!);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
    });

    // PDF をアップロード
    console.log(`  PDFアップロード中: ${path.basename(pdfPath)}`);
    const uploadResult = await fileManager.uploadFile(pdfPath, {
        mimeType: 'application/pdf',
        displayName: path.basename(pdfPath),
    });
    const file = uploadResult.file;

    // ファイル処理待ち
    let state = file.state;
    while (state === 'PROCESSING') {
        await new Promise(r => setTimeout(r, 2000));
        const current = await fileManager.getFile(file.name);
        state = current.state;
    }
    if (state !== 'ACTIVE') throw new Error(`ファイル処理失敗: ${state}`);

    // Gemini で問題データを抽出
    console.log('  Gemini APIで問題抽出中...');
    const result = await model.generateContent([
        { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
        { text: promptText }
    ]);

    const responseText = result.response.text();
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');

    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : (parsed.questions || []);
}

function mergeQuestions(existing: any[], extracted: any[], expected: number): { merged: any[]; added: number; replaced: number } {
    // 既存データの問題番号マップ
    const existingMap = new Map<number, any>();
    for (const q of existing) {
        const qNo = Number(q.qNo);
        if (Number.isFinite(qNo)) existingMap.set(qNo, q);
    }

    const extractedMap = new Map<number, any>();
    for (const q of extracted) {
        const qNo = Number(q.qNo);
        if (Number.isFinite(qNo)) extractedMap.set(qNo, q);
    }

    const merged: any[] = [];
    let added = 0, replaced = 0;

    for (let i = 1; i <= expected; i++) {
        const existingQ = existingMap.get(i);
        const extractedQ = extractedMap.get(i);

        if (existingQ) {
            // 既存データがある場合: 選択肢が4つ揃っていれば既存を優先
            const opts = existingQ.options;
            if (Array.isArray(opts) && opts.length === 4 && opts.every((o: any) => o.id && o.text)) {
                merged.push(existingQ);
            } else if (extractedQ) {
                // 既存が破損 → 新抽出で置換
                // 既存の explanation があれば引き継ぐ
                if (existingQ.explanation && !extractedQ.explanation) {
                    extractedQ.explanation = existingQ.explanation;
                }
                if (existingQ.correctOption && !extractedQ.correctOption) {
                    extractedQ.correctOption = existingQ.correctOption;
                }
                merged.push(extractedQ);
                replaced++;
            } else {
                // 既存は破損しているが新抽出にもない → そのまま残す
                merged.push(existingQ);
            }
        } else if (extractedQ) {
            // 既存にない → 新規追加
            merged.push(extractedQ);
            added++;
        }
        // どちらにもない場合はスキップ（後で報告）
    }

    return { merged, added, replaced };
}

async function main() {
    const { filter, dryRun } = parseArgs();
    const rawPdfDir = path.resolve(__dirname, '../../data/raw_pdfs');
    const questionsDir = path.resolve(__dirname, '../../data/questions');
    const promptPath = path.resolve(__dirname, '../../../../docs/prompts/gemini_ocr_prompt.md');

    let promptText = await fs.readFile(promptPath, 'utf-8');
    promptText += '\n\nIMPORTANT: Output ONLY the JSON array. Do not wrap in markdown code blocks.';
    promptText += '\nIMPORTANT: Extract ALL questions from question 1 to the last question (typically question 80). Do NOT stop early.';

    console.log('=== 午前問題 再抽出・補完 ===');
    if (dryRun) console.log('[DRY-RUN モード]');

    const targets = filter ? TARGETS.filter(t => t.examId.includes(filter)) : TARGETS;

    for (const target of targets) {
        const { examId, expected } = target;
        console.log(`\n--- ${examId} (期待: ${expected}問) ---`);

        const pdfPath = path.join(rawPdfDir, `${examId}.pdf`);
        const questionsPath = path.join(questionsDir, examId, 'questions_raw.json');
        const answersPath = path.join(questionsDir, examId, 'answers_raw.json');

        // PDF 存在確認
        try { await fs.access(pdfPath); } catch {
            console.log(`  ⚠ PDFが見つかりません: ${pdfPath}`);
            continue;
        }

        // 既存データ読み込み
        let existing: any[] = [];
        try {
            const raw = JSON.parse(await fs.readFile(questionsPath, 'utf-8'));
            existing = Array.isArray(raw) ? raw : (raw.questions || []);
            console.log(`  既存データ: ${existing.length}問`);
        } catch {
            console.log('  既存データなし');
        }

        // 正答データ読み込み
        let answers: Record<string, string> = {};
        try {
            answers = JSON.parse(await fs.readFile(answersPath, 'utf-8'));
        } catch { /* answers なくても続行 */ }

        if (existing.length >= expected) {
            console.log(`  ✅ 既に${expected}問揃っています。スキップ。`);
            continue;
        }

        if (dryRun) {
            console.log(`  [DRY-RUN] 欠損: ${expected - existing.length}問。再抽出が必要。`);
            continue;
        }

        // バックアップ
        const backupPath = questionsPath.replace('.json', `_backup_${Date.now()}.json`);
        try {
            await fs.copyFile(questionsPath, backupPath);
            console.log(`  バックアップ: ${path.basename(backupPath)}`);
        } catch { /* 元ファイルがなければスキップ */ }

        // Gemini で再抽出
        try {
            const extracted = await uploadAndExtract(pdfPath, promptText);
            console.log(`  抽出結果: ${extracted.length}問`);

            // 正答をマージ（抽出データには correctOption がないことが多い）
            for (const q of extracted) {
                const ans = answers[String(q.qNo)];
                if (ans && !q.correctOption) q.correctOption = ans;
            }

            // 既存 + 抽出をマージ
            const { merged, added, replaced } = mergeQuestions(existing, extracted, expected);

            // 既存データの explanation を新規問題に引き継ぐ（answers_raw.json からの correctOption 適用）
            for (const q of merged) {
                const ans = answers[String(q.qNo)];
                if (ans && !q.correctOption) q.correctOption = ans;
            }

            // ソート
            merged.sort((a, b) => Number(a.qNo) - Number(b.qNo));

            // 保存
            await fs.writeFile(questionsPath, JSON.stringify(merged, null, 2));
            console.log(`  ✅ 保存完了: ${merged.length}問 (追加: ${added}, 置換: ${replaced})`);

            // 不足チェック
            const qNos = new Set(merged.map(q => Number(q.qNo)));
            const missing: number[] = [];
            for (let i = 1; i <= expected; i++) {
                if (!qNos.has(i)) missing.push(i);
            }
            if (missing.length > 0) {
                console.log(`  ⚠ まだ欠損: Q${missing.join(', Q')}`);
            }

        } catch (e: any) {
            console.error(`  ❌ 抽出エラー: ${e.message}`);
        }
    }

    console.log('\n=== 完了 ===');
}

main().catch(console.error);
