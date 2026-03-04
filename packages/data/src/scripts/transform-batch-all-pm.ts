/**
 * 全午後問題の一括構造化変換スクリプト
 *
 * SC午後だけでなく、PM/SA/ST/AP/FE の午後問題も対象とする汎用版。
 * questions_raw.json → questions_transformed.json を生成する。
 *
 * 使い方:
 *   npx ts-node src/scripts/transform-batch-all-pm.ts [--force] [--filter <pattern>] [--dry-run]
 *
 * オプション:
 *   --force     既存の questions_transformed.json を上書き
 *   --filter    対象ディレクトリ名のフィルタ（部分一致）例: --filter SC-2016
 *   --dry-run   変換対象の一覧を表示するのみ（API呼び出しなし）
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 環境変数の読み込み
const possibleEnvPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
    path.resolve(__dirname, '../../../../.env'),
];

for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
}

const API_KEY = (process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY) as string;

const MODEL_NAME = "gemini-2.5-flash";
const DATA_DIR = path.resolve(__dirname, '../../data/questions');
const PROMPT_FILE_PATH = path.resolve(__dirname, '../../prompts/transform_sc_pm.md');

interface TransformedQuestion {
    id?: string;
    qNo?: number;
    context?: {
        background: string;
    };
    questions?: any[];
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * リトライ付きAPI呼び出し
 */
async function callWithRetry(
    fn: () => Promise<any>,
    maxRetries: number = 3,
    baseDelay: number = 15000
): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (e: any) {
            const isRetryable = e.message?.includes('fetch failed')
                || e.message?.includes('429')
                || e.message?.includes('503')
                || e.message?.includes('RESOURCE_EXHAUSTED')
                || e.message?.includes('overloaded');
            if (!isRetryable || attempt === maxRetries) {
                throw e;
            }
            const waitMs = baseDelay * Math.pow(2, attempt - 1);
            console.log(`  [RETRY] ${attempt}/${maxRetries} - ${waitMs / 1000}秒後にリトライ...`);
            await delay(waitMs);
        }
    }
}

/**
 * 午後問題のディレクトリかどうかを判定する。
 * 対象: *-PM, *-PM1, *-PM2（AM2は除外）
 */
function isPMDirectory(dirName: string): boolean {
    return /-(PM\d?|PM)$/.test(dirName);
}

/**
 * 変換が必要かどうかを判定する。
 * questions_raw.json の構造を再帰的に走査し、以下を検出:
 * - subQuestions に answer/explanation が欠落
 * - subQuestions が空配列
 * - context フィールドの欠落（旧形式）
 *
 * PM午後問題の典型構造:
 *   { questions: [ { qNo:1, questions: [ { subQNo:"設問1", subQuestions: [...] } ] } ] }
 *   → 3階層: 大問 → 設問 → 小問
 */
function needsTransform(rawPath: string): { needed: boolean; reason: string } {
    try {
        const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));

        // トップレベルの questions 配列を取得（大問レベル）
        const topQuestions = Array.isArray(raw)
            ? raw
            : (raw.questions || []);

        if (topQuestions.length === 0) {
            return { needed: false, reason: 'questions配列が空' };
        }

        let totalSubQ = 0;
        let missingAnswer = 0;
        let emptySubQ = 0;
        let hasNestedQuestions = false;

        for (const q of topQuestions) {
            // パターン1: 直接 subQuestions がある（2階層構造）
            const directSubs = q.subQuestions || [];
            if (q.subQNo && directSubs.length === 0 && q.text) {
                emptySubQ++;
            }
            for (const sq of directSubs) {
                totalSubQ++;
                if (!sq.answer && !sq.explanation) {
                    missingAnswer++;
                }
            }

            // パターン2: 大問 → 設問(questions[]) → 小問(subQuestions[]) の3階層構造
            const nestedQuestions = q.questions || [];
            if (nestedQuestions.length > 0) {
                hasNestedQuestions = true;
                for (const nq of nestedQuestions) {
                    const nSubs = nq.subQuestions || [];
                    if (nq.subQNo && nSubs.length === 0 && nq.text) {
                        emptySubQ++;
                    }
                    for (const sq of nSubs) {
                        totalSubQ++;
                        if (!sq.answer && !sq.explanation) {
                            missingAnswer++;
                        }
                    }
                }
            }
        }

        if (emptySubQ > 0) {
            return { needed: true, reason: `空subQuestions: ${emptySubQ}件` };
        }
        if (totalSubQ > 0 && missingAnswer > 0) {
            return { needed: true, reason: `answer/explanation欠落: ${missingAnswer}/${totalSubQ}件` };
        }

        // context フィールドの有無をチェック（3階層構造の場合は各大問のcontextを確認）
        if (hasNestedQuestions) {
            const noContext = topQuestions.filter((q: any) => !q.context && (q.description || q.theme));
            if (noContext.length > 0) {
                return { needed: true, reason: `contextフィールドなし: ${noContext.length}件の大問` };
            }
        } else {
            const topLevel = Array.isArray(raw) ? raw[0] : raw;
            if (!topLevel?.context && (topLevel?.description || topLevel?.theme)) {
                return { needed: true, reason: 'contextフィールドなし（旧形式）' };
            }
        }

        return { needed: false, reason: '正常' };
    } catch (e: any) {
        return { needed: false, reason: `パースエラー: ${e.message}` };
    }
}

/**
 * 変換後データの設問数バリデーション
 */
function validateTransformed(rawPath: string, transformed: any): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));

    // 元データの設問数
    const rawQuestions = Array.isArray(raw) ? raw : (raw.questions || []);
    const rawSubQCount = rawQuestions.reduce((acc: number, q: any) => {
        return acc + (q.subQuestions?.length || 0);
    }, 0);

    // 変換データの設問数
    const transData = Array.isArray(transformed) ? transformed : [transformed];
    let transSubQCount = 0;
    let transWithAnswer = 0;

    for (const tq of transData) {
        const qs = tq.questions || [];
        for (const q of qs) {
            const subs = q.subQuestions || [];
            transSubQCount += subs.length;
            transWithAnswer += subs.filter((s: any) => s.answer).length;
        }
    }

    // 背景テキスト長のバリデーション
    let rawTextLen = 0;
    if (!Array.isArray(raw) && raw.description) {
        rawTextLen = raw.description.length;
    } else {
        for (const q of rawQuestions) {
            if (q.text) rawTextLen += q.text.length;
            if (q.description) rawTextLen += q.description.length;
        }
    }

    let transTextLen = 0;
    for (const tq of transData) {
        if (tq.context?.background) transTextLen += tq.context.background.length;
    }

    const ratio = rawTextLen > 0 ? transTextLen / rawTextLen : 0;

    if (ratio < 0.7) {
        warnings.push(`背景テキスト比率が低い: ${(ratio * 100).toFixed(0)}% (元: ${rawTextLen}字, 変換: ${transTextLen}字)`);
    }

    if (transSubQCount === 0 && rawSubQCount > 0) {
        warnings.push(`subQuestionsが全て消失 (元: ${rawSubQCount}件)`);
    }

    return { valid: warnings.length === 0, warnings };
}

async function main() {
    const args = process.argv.slice(2);
    const force = args.includes('--force');
    const dryRun = args.includes('--dry-run');
    const checkTheme = args.includes('--check-theme');
    const filterIdx = args.indexOf('--filter');
    const filterPattern = filterIdx !== -1 ? args[filterIdx + 1] : null;

    console.log("=== 午後問題 一括構造化変換 ===");
    console.log(`モード: ${dryRun ? 'ドライラン' : '実行'}`);
    console.log(`強制上書き: ${force ? 'はい' : 'いいえ'}`);
    console.log(`テーマ欠落チェック: ${checkTheme ? 'はい' : 'いいえ'}`);
    if (filterPattern) console.log(`フィルタ: ${filterPattern}`);

    // 1. 対象ディレクトリの特定
    const allDirs = fs.readdirSync(DATA_DIR).filter(d => {
        const fullPath = path.join(DATA_DIR, d);
        return fs.statSync(fullPath).isDirectory() && isPMDirectory(d);
    });

    let targetDirs = allDirs;
    if (filterPattern) {
        targetDirs = targetDirs.filter(d => d.includes(filterPattern));
    }

    console.log(`\n午後試験ディレクトリ: ${targetDirs.length}件`);

    // 2. 変換要否の判定
    const toProcess: { dir: string; reason: string }[] = [];
    const skipped: { dir: string; reason: string }[] = [];

    for (const dir of targetDirs) {
        const rawPath = path.join(DATA_DIR, dir, 'questions_raw.json');
        const transformedPath = path.join(DATA_DIR, dir, 'questions_transformed.json');

        if (!fs.existsSync(rawPath)) {
            skipped.push({ dir, reason: 'questions_raw.jsonなし' });
            continue;
        }

        if (fs.existsSync(transformedPath) && !force) {
            // --check-theme: テーマ/コンテキスト欠落を検出し、再変換対象にする
            if (checkTheme) {
                try {
                    const transformed = JSON.parse(fs.readFileSync(transformedPath, 'utf-8'));
                    const questions = Array.isArray(transformed) ? transformed : [transformed];
                    const missingTheme = questions.some((q: any) => !q.theme || q.theme.trim() === '');
                    const missingContext = questions.some((q: any) => !q.context || !q.context.background);
                    if (missingTheme || missingContext) {
                        const reasons: string[] = [];
                        if (missingTheme) reasons.push('theme欠落');
                        if (missingContext) reasons.push('context欠落');
                        toProcess.push({ dir, reason: reasons.join(', ') });
                        continue;
                    }
                } catch {
                    // パースエラー時は再変換対象
                    toProcess.push({ dir, reason: 'transformed JSON パースエラー' });
                    continue;
                }
            }
            skipped.push({ dir, reason: 'transformed済み（--forceで上書き可）' });
            continue;
        }

        const { needed, reason } = needsTransform(rawPath);
        if (needed || force) {
            toProcess.push({ dir, reason });
        } else {
            skipped.push({ dir, reason: `変換不要: ${reason}` });
        }
    }

    console.log(`\n変換対象: ${toProcess.length}件`);
    toProcess.forEach(({ dir, reason }) => console.log(`  [TODO] ${dir} - ${reason}`));

    console.log(`\nスキップ: ${skipped.length}件`);
    skipped.forEach(({ dir, reason }) => console.log(`  [SKIP] ${dir} - ${reason}`));

    if (dryRun) {
        console.log("\n--- ドライラン終了 ---");
        return;
    }

    if (toProcess.length === 0) {
        console.log("\n変換対象がありません。");
        return;
    }

    // API キーの確認
    if (!API_KEY) {
        console.error("\nGEMINI_API_KEY_2 または GEMINI_API_KEY が設定されていません。");
        process.exit(1);
    }

    console.log(`\nAPI Key: ${API_KEY.length}文字`);
    console.log(`モデル: ${MODEL_NAME}`);

    // プロンプトの読み込み
    if (!fs.existsSync(PROMPT_FILE_PATH)) {
        console.error(`プロンプトファイルが見つかりません: ${PROMPT_FILE_PATH}`);
        process.exit(1);
    }
    const promptText = fs.readFileSync(PROMPT_FILE_PATH, 'utf-8');

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" }
    });

    let successCount = 0;
    let failCount = 0;

    // 3. 変換の実行
    for (let i = 0; i < toProcess.length; i++) {
        const { dir } = toProcess[i];
        console.log(`\n[${i + 1}/${toProcess.length}] ${dir}`);

        const examPath = path.join(DATA_DIR, dir);
        const rawFilePath = path.join(examPath, 'questions_raw.json');
        const outputFilePath = path.join(examPath, 'questions_transformed.json');

        try {
            let rawData = fs.readFileSync(rawFilePath, 'utf-8');
            
            // ★ mermaidブロックを事前にプレースホルダーに置換（JSON破損防止）
            const mermaidBlocks: string[] = [];
            rawData = rawData.replace(/```mermaid\n([\s\S]*?)```/g, (_match, content) => {
                const idx = mermaidBlocks.length;
                mermaidBlocks.push(content.trim());
                return `{{diagram:mermaid_${idx}}}`;
            });
            // コードブロック（cpp, text等）も置換
            rawData = rawData.replace(/```(\w+)\n([\s\S]*?)```/g, (_match, lang, content) => {
                const idx = mermaidBlocks.length;
                mermaidBlocks.push(content.trim());
                return `{{codeblock:${lang}_${idx}}}`;
            });
            if (mermaidBlocks.length > 0) {
                console.log(`  [PRE] ${mermaidBlocks.length}個のコードブロックをプレースホルダーに置換`);
            }

            const totalInputLength = rawData.length;

            // プロンプトの試験区分に合わせた調整
            const examPrefix = dir.split('-')[0];
            let examTypeHint = '';
            if (examPrefix === 'SC') examTypeHint = '情報処理安全確保支援士（SC）';
            else if (examPrefix === 'PM') examTypeHint = 'プロジェクトマネージャ（PM）';
            else if (examPrefix === 'SA') examTypeHint = 'システムアーキテクト（SA）';
            else if (examPrefix === 'ST') examTypeHint = 'ITストラテジスト（ST）';
            else if (examPrefix === 'AP') examTypeHint = '応用情報技術者（AP）';
            else if (examPrefix === 'FE') examTypeHint = '基本情報技術者（FE）';

            const fullPrompt = `
${promptText}

## 追加コンテキスト
- 試験区分: ${examTypeHint}
- 試験ID: ${dir}

## 重要な追加制約（JSON出力の安全性）
- 出力はJSON形式のみです。Markdownコードブロック(\`\`\`)で囲まないでください。
- JSON文字列値の中にバックティック(\`)を含めないでください。
- 入力データ内の {{diagram:mermaid_N}} や {{codeblock:lang_N}} はプレースホルダーです。そのまま出力してください。変換や展開は不要です。
- context.background 内の図表プレースホルダー（{{diagram:...}}）はそのまま保持してください。

---

## Input Data (Raw JSON)

\`\`\`json
${rawData}
\`\`\`
            `;

            console.log(`  Gemini API送信中... (入力: ${totalInputLength.toLocaleString()}文字)`);

            const apiResult = await callWithRetry(async () => {
                const result = await model.generateContent(fullPrompt);
                const response = await result.response;
                return response.text();
            });
            const text = apiResult as string;

            // JSONの抽出（responseMimeType: "application/json" 使用時は直接パースを優先）
            let parsedData: TransformedQuestion | TransformedQuestion[] | null = null;

            /**
             * 不正なJSONエスケープを修復する。
             * Gemini APIが出力するJSON文字列内のバックティック（```）やタブ文字が
             * 正しくエスケープされないケースに対応。
             */
            function fixBadEscapes(jsonStr: string): string {
                // JSON文字列内の不正なエスケープシーケンスを修復
                // \m, \g, \s, \d 等のJSONで未定義なエスケープを削除
                // 正当なエスケープ: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
                return jsonStr.replace(/\\([^"\\/bfnrtu])/g, (match, ch) => {
                    // バックスラッシュ+未知文字 → 文字のみに
                    return ch;
                });
            }

            /**
             * JSON文字列内のmermaidバックティック(```)をプレースホルダーに置換する。
             */
            function sanitizeMermaidInJson(jsonStr: string): string {
                // JSON文字列値内の ``` を除去（文字列内に埋め込まれたmermaidブロック対策）
                // "..." の中身を処理
                return jsonStr.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
                    return match.replace(/```/g, '[CODE_BLOCK]');
                });
            }

            function tryParseJson(str: string): any | null {
                // 試行1: そのまま
                try { return JSON.parse(str); } catch {}
                // 試行2: 不正エスケープ修復
                try { return JSON.parse(fixBadEscapes(str)); } catch {}
                // 試行3: mermaidバックティック除去 + 不正エスケープ修復
                try { return JSON.parse(fixBadEscapes(sanitizeMermaidInJson(str))); } catch {}
                return null;
            }

            // 試行1: レスポンスを直接JSONパース（responseMimeType: "application/json" の場合）
            parsedData = tryParseJson(text);

            if (!parsedData) {
                // 試行2: JSON部分を境界抽出
                const firstBracket = text.search(/[\[{]/);
                if (firstBracket >= 0) {
                    const opener = text[firstBracket];
                    const closer = opener === '[' ? ']' : '}';
                    let depth = 0;
                    let inString = false;
                    let escape = false;
                    let end = -1;

                    for (let ci = firstBracket; ci < text.length; ci++) {
                        const ch = text[ci];
                        if (escape) { escape = false; continue; }
                        if (ch === '\\') { escape = true; continue; }
                        if (ch === '"') { inString = !inString; continue; }
                        if (inString) continue;
                        if (ch === opener) depth++;
                        if (ch === closer) { depth--; if (depth === 0) { end = ci; break; } }
                    }

                    if (end > firstBracket) {
                        const extracted = text.substring(firstBracket, end + 1);
                        parsedData = tryParseJson(extracted);
                        if (parsedData) {
                            console.log(`  [RECOVERED] JSON修復+境界抽出で成功`);
                        }
                    }
                }
            }

            if (!parsedData) {
                console.error(`  [ERROR] JSONパース失敗。先頭500文字:`);
                console.log(text.substring(0, 500));
                throw new Error('JSONパース失敗');
            }

            // バリデーション
            const { valid, warnings } = validateTransformed(rawFilePath, parsedData);
            if (warnings.length > 0) {
                warnings.forEach(w => console.warn(`  [WARN] ${w}`));
            }

            // ★ プレースホルダーをmermaid/コードブロックに復元
            let outputJson = JSON.stringify(parsedData, null, 2);
            if (mermaidBlocks.length > 0) {
                outputJson = outputJson.replace(/\{\{diagram:mermaid_(\d+)\}\}/g, (_m, idx) => {
                    const i = parseInt(idx);
                    return i < mermaidBlocks.length
                        ? '```mermaid\\n' + mermaidBlocks[i].replace(/\n/g, '\\n').replace(/"/g, '\\"') + '\\n```'
                        : _m;
                });
                outputJson = outputJson.replace(/\{\{codeblock:(\w+)_(\d+)\}\}/g, (_m, lang, idx) => {
                    const i = parseInt(idx);
                    return i < mermaidBlocks.length
                        ? '```' + lang + '\\n' + mermaidBlocks[i].replace(/\n/g, '\\n').replace(/"/g, '\\"') + '\\n```'
                        : _m;
                });
                console.log(`  [POST] プレースホルダーを${mermaidBlocks.length}個のコードブロックに復元`);
                // 復元後JSONの検証
                try {
                    JSON.parse(outputJson);
                } catch {
                    console.warn(`  [WARN] 復元後JSONが不正。プレースホルダーのまま保存`);
                    outputJson = JSON.stringify(parsedData, null, 2);
                }
            }

            // 保存
            fs.writeFileSync(outputFilePath, outputJson, 'utf-8');
            console.log(`  [SUCCESS] ${outputFilePath}`);
            successCount++;

            // レートリミット対策（15秒間隔）
            if (i < toProcess.length - 1) {
                const waitMs = 15000;
                console.log(`  ${waitMs / 1000}秒待機...`);
                await delay(waitMs);
            }

        } catch (e: any) {
            console.error(`  [ERROR] ${dir}: ${e.message}`);
            fs.writeFileSync(
                path.join(examPath, 'transform_error.log'),
                `${new Date().toISOString()}\n${e.message}\n\n${e.stack}`,
                'utf-8'
            );
            failCount++;

            // 連続失敗時はAPI冷却のためさらに待機
            if (e.message?.includes('fetch failed') || e.message?.includes('429')) {
                console.log(`  API冷却のため60秒待機...`);
                await delay(60000);
            }
        }
    }

    console.log("\n=== 変換完了 ===");
    console.log(`成功: ${successCount}`);
    console.log(`失敗: ${failCount}`);
    console.log(`スキップ: ${skipped.length}`);
}

main().catch(console.error);
