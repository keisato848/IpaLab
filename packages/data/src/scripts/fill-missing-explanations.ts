
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
const envPaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env')
];

envPaths.forEach(envPath => {
    dotenv.config({ path: envPath });
});

console.log('Using @google/genai SDK with Gemini 2.0 Flash Exp.');

const SYSTEM_PROMPT = `
あなたは情報処理技術者試験（応用情報技術者試験・AP）の学習メンターです。
与えられた「問題文」「選択肢」「正解」に基づき、学習者が理解しやすい**解説**を作成してください。

# 制約事項
- **初心者にもわかりやすく**、専門用語は必要に応じて補足してください。
- **簡潔に**記述してください（200〜400文字程度）。
- 正解の選択肢が**なぜ正しいのか**を論理的に説明してください。
- 他の選択肢が**なぜ誤りなのか**も簡単に触れてください。
- Markdown形式で出力してください（箇条書き、太字など使用可）。
- 「### 解説」などの見出しは不要です。本文のみを出力してください。
`;

async function generateExplanationWithFallback(question: any) {
    const prompt = `
# 問題
${question.text}

# 選択肢
${question.options.map((o: any) => `- ${o.id}: ${o.text}`).join('\n')}

# 正解
${question.correctOption}

この問題の解説を作成してください。
`;

    // Configuration for Fallback
    // Prioritize gemini-2.0-flash-exp as it was confirmed working
    const keys = [
        { key: process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY, type: 'Primary', model: 'gemini-2.5-flash' },
        { key: process.env.GEMINI_API_KEY, type: 'Backup', model: 'gemini-2.5-flash' }
    ];

    for (const config of keys) {
        if (!config.key) continue;

        try {
            const ai = new GoogleGenAI({ apiKey: config.key });
            const result = await ai.models.generateContent({
                model: config.model,
                contents: {
                    role: "user",
                    parts: [
                        { text: SYSTEM_PROMPT + "\n" + prompt }
                    ]
                }
            });

            if (result && result.text) {
                return result.text;
            } else {
                throw new Error("Empty response text");
            }

        } catch (e: any) {
            console.warn(`    ! Failed with ${config.type} (${config.model}): ${e.message}`);
            if (e.cause) console.warn('      Cause:', e.cause);
            // Continue to next key
        }
    }
    throw new Error('All fallbacks failed');
}

async function processQuestion(q: any) {
    // Skip if explanation exists and is long enough
    if (q.explanation && q.explanation.length > 20) {
        return false; // Skipped
    }
    // Skip if no text or options (bad data)
    if (!q.text || !q.options || !q.correctOption) {
        return false; // Skipped
    }

    try {
        const explanation = await generateExplanationWithFallback(q);
        q.explanation = explanation.trim();
        return true; // Success
    } catch (e: any) {
        console.error(`    x Q${q.qNo} Failed: ${e.message}`);
        return false; // Failed
    }
}

async function main() {
    const questionsDir = path.resolve(__dirname, '../../data/questions');

    const dirs = fs.readdirSync(questionsDir).filter(d =>
        d.match(/^[A-Z]{2,4}-\d{4}/)
    );

    // Sort to process newest first, but prioritize FE due to user request
    dirs.sort((a, b) => {
        const isFE_A = a.startsWith('FE');
        const isFE_B = b.startsWith('FE');
        if (isFE_A && !isFE_B) return -1;
        if (!isFE_A && isFE_B) return 1;
        return a.localeCompare(b) * -1; // Reverse alphabetical for others
    });

    console.log(`Found ${dirs.length} exams to check.`);

    const BATCH_SIZE = 5; // Restore parallelism for Gemini 2.5 Flash

    for (const dir of dirs) {
        const transformedPath = path.join(questionsDir, dir, 'questions_transformed.json');
        const rawPath = path.join(questionsDir, dir, 'questions_raw.json');

        let targetPath = fs.existsSync(transformedPath) ? transformedPath : rawPath;
        if (!fs.existsSync(targetPath)) continue;

        // Load content to check if work is needed
        let content = fs.readFileSync(targetPath, 'utf-8');
        let data = JSON.parse(content);
        let questions = Array.isArray(data) ? data : (data.questions || []);

        // Quick check: any missing explanations?
        const needsWork = questions.some((q: any) =>
            q.text && q.options && q.correctOption && (!q.explanation || q.explanation.length <= 20)
        );

        if (!needsWork) {
            // console.log(`[SKIP] ${dir} - All done.`);
            continue;
        }

        console.log(`Processing ${dir} using ${path.basename(targetPath)}...`);

        // Always try to load answers (backup for FE/AP) if needed - logic preserved
        if (true) {
            const answersPath = path.join(questionsDir, dir, 'answers_raw.json');
            if (fs.existsSync(answersPath)) {
                try {
                    const answerData = JSON.parse(fs.readFileSync(answersPath, 'utf-8'));
                    let answers: any[] = [];
                    if (Array.isArray(answerData)) {
                        answers = answerData;
                    } else if (answerData.answers) {
                        answers = answerData.answers;
                    } else {
                        answers = Object.keys(answerData).map(k => ({ qNo: parseInt(k), correctOption: answerData[k] }));
                    }

                    const ansMap = new Map(answers.map((a: any) => [a.qNo, a.correctOption]));
                    questions.forEach((q: any) => {
                        if (!q.correctOption && ansMap.has(q.qNo)) q.correctOption = ansMap.get(q.qNo);
                    });
                } catch (e) { }
            }
        }

        let updateCount = 0;
        let modifiedInFile = false;

        // Process in batches
        for (let i = 0; i < questions.length; i += BATCH_SIZE) {
            const batch = questions.slice(i, i + BATCH_SIZE);
            const promises = batch.map((q: any) => processQuestion(q));

            const results = await Promise.all(promises);
            const successCount = results.filter((r: boolean) => r).length;

            if (successCount > 0) {
                updateCount += successCount;
                modifiedInFile = true;
                process.stdout.write(`.`);
            }

            if (modifiedInFile) {
                fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
            }

            await new Promise(r => setTimeout(r, 1000)); // Standard delay
        }
        console.log(`\n  Completed ${dir}. New Explanations: ${updateCount}`);
    }
}

if (require.main === module) {
    main().catch(console.error);
}
