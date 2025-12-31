
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

export async function POST(req: NextRequest) {
    if (!apiKey) {
        return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { question, userAnswer, modelAnswer } = body;

        if (!question || !userAnswer) {
            return NextResponse.json({ error: 'Missing question or user answer' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const prompt = `
あなたは情報処理技術者試験（IPA）の採点スペシャリストです。
以下の記述式回答を、厳格な「CLKS評価モデル」に基づいて採点し、JSON形式で出力してください。

# CLKS評価モデル
1. **C (Context - 設問適合性)**: 設問の意図、制約条件、背景事情を捉えているか。
2. **L (Logic - 論理的妥当性)**: 因果関係が論理的に成立しているか。
3. **K (Keyword - 知識と語彙)**: 必須キーワードが含まれているか。
4. **S (Specificity - 具体性)**: 「適切に」「確認する」等の曖昧な表現を避け、具体的に記述しているか。

# 入力データ
- **設問**: ${question}
- **模範解答**: ${modelAnswer || '（なし）'}
- **ユーザーの回答**: ${userAnswer}

# 出力フォーマット (JSON Schema)
以下のJSON構造のみを出力してください。Markdownブロックは不要です。

{
  "score": 0〜100の整数,
  "radarChartData": [
    { "subject": "設問適合性", "A": 0-10の点数, "fullMark": 10 },
    { "subject": "論理構成", "A": 0-10の点数, "fullMark": 10 },
    { "subject": "重要語句", "A": 0-10の点数, "fullMark": 10 },
    { "subject": "具体性", "A": 0-10の点数, "fullMark": 10 }
  ],
  "feedback": "具体的な改善点を含むフィードバック（200文字以内）",
  "mermaidDiagram": "採点結果を改善へ導くMermaid記法（graph TD）の文字列。例: graph TD; A[現状] --> B(改善策)...",
  "improvedAnswer": "CLKSを満たした改善回答例"
}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON safely
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error("JSON Parse Error:", responseText);
            return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Scoring API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
