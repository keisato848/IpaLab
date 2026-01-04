import { GoogleGenerativeAI } from '@google/generative-ai';
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

// Load API Keys
const apiKey = process.env.GEMINI_API_KEY_2;
if (!apiKey) {
    throw new Error('GEMINI_API_KEY_2 (Paid Key) not found in environment variables.');
}

console.log('Using PAID KEY (GEMINI_API_KEY_2) exclusively for high speed parallel processing.');

// Client factory (Single key mode)
function getGeminiClient() {
    return new GoogleGenerativeAI(apiKey!).getGenerativeModel({
        model: "gemini-flash-latest",
    });
}

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

async function generateExplanation(model: any, question: any) {
    const prompt = `
# 問題
${question.text}

# 選択肢
${question.options.map((o: any) => `- ${o.id}: ${o.text}`).join('\n')}

# 正解
${question.correctOption}

この問題の解説を作成してください。
`;

    try {
        const result = await model.generateContent([
            { text: SYSTEM_PROMPT },
            { text: prompt }
        ]);
        return result.response.text();
    } catch (e: any) {
        if (e.status === 429 || e.message?.includes('429')) {
            throw new Error('RateLimit');
        }
        throw e;
    }
}

async function processQuestion(model: any, q: any) {
    // Skip if explanation exists and is long enough
    if (q.explanation && q.explanation.length > 20) {
        return false; // Skipped
    }
    // Skip if no text or options (bad data)
    if (!q.text || !q.options || !q.correctOption) {
        return false; // Skipped
    }

    try {
        const explanation = await generateExplanation(model, q);
        q.explanation = explanation.trim();
        return true; // Success
    } catch (e: any) {
        console.error(`    x Q${q.qNo} Failed: ${e.message}`);
        return false; // Failed
    }
}

async function main() {
    const questionsDir = path.resolve(__dirname, '../../data/questions');

    // Target only AP Morning exams
    const dirs = fs.readdirSync(questionsDir).filter(d =>
        d.startsWith('AP-') && d.endsWith('-AM')
    );

    // Sort to process newest first (usually most relevant)
    dirs.sort().reverse();

    console.log(`Found ${dirs.length} AP exams to check.`);

    const model = getGeminiClient();
    const BATCH_SIZE = 15; // Parallel requests

    for (const dir of dirs) {
        const jsonPath = path.join(questionsDir, dir, 'questions_raw.json');
        if (!fs.existsSync(jsonPath)) continue;

        console.log(`Processing ${dir}...`);

        let content = fs.readFileSync(jsonPath, 'utf-8');
        let data = JSON.parse(content);
        let questions = Array.isArray(data) ? data : data.questions;
        let updateCount = 0;
        let modifiedInFile = false;

        // Process in batches
        for (let i = 0; i < questions.length; i += BATCH_SIZE) {
            const batch = questions.slice(i, i + BATCH_SIZE);
            const promises = batch.map((q: any) => processQuestion(model, q));

            const results = await Promise.all(promises);
            const successCount = results.filter((r: boolean) => r).length;

            if (successCount > 0) {
                updateCount += successCount;
                modifiedInFile = true;
                process.stdout.write(`.`); // Progress dot
            }

            // Save after every batch to keep progress safe
            if (modifiedInFile) {
                fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
            }

            // Tiny delay to be safe
            await new Promise(r => setTimeout(r, 500));
        }
        console.log(`\n  Completed ${dir}. New Explanations: ${updateCount}`);
    }
}

if (require.main === module) {
    main().catch(console.error);
}
