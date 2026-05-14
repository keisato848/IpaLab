import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAiChatAuthHeaders } from '@/lib/ai-chat-auth';

export const runtime = 'nodejs';

// 採点用システムプロンプト
const SYSTEM_PROMPT =
    'あなたは情報処理技術者試験（IPA）の採点スペシャリストです。JSONフォーマットで結果を出力してください。余計な前置きや説明は不要です。';

/**
 * 採点用プロンプトを生成する
 */
function buildScoringPrompt(question: string, userAnswer: string, modelAnswer?: string): string {
    return `以下の記述式回答を、厳格な「CLKS評価モデル」に基づいて採点し、JSON形式で出力してください。

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
}`;
}

function getAiChatFunctionUrl(): string {
    return process.env.AI_CHAT_FUNCTION_URL?.trim() || '';
}

function isAzureHostedRuntime(): boolean {
    return Boolean(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_INSTANCE_ID);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { question, userAnswer, modelAnswer } = body;

        if (!question || !userAnswer) {
            return NextResponse.json({ error: 'Missing question or user answer' }, { status: 400 });
        }

        const prompt = buildScoringPrompt(question, userAnswer, modelAnswer);
        let responseText: string;

        const aiChatFunctionUrl = getAiChatFunctionUrl();

        if (aiChatFunctionUrl) {
            // 本番: US Azure Function 経由（East Asia から Gemini への地域制限を回避）
            const requestBody = JSON.stringify({ systemPrompt: SYSTEM_PROMPT, userMessage: prompt });
            let authHeaders: Record<string, string>;
            try {
                authHeaders = createAiChatAuthHeaders(requestBody);
            } catch (error) {
                console.error('AI_CHAT_FUNCTION_SECRET is not set for AI proxy request');
                return NextResponse.json({ error: 'AI proxy authentication is not configured' }, { status: 503 });
            }

            const res = await fetch(aiChatFunctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: requestBody,
            });
            if (!res.ok) {
                throw new Error(`AI proxy failed: ${res.status} ${await res.text().catch(() => '')}`);
            }
            const data = (await res.json()) as { text?: string; error?: string };
            if (data.error) throw new Error(data.error);
            responseText = data.text ?? '';
        } else {
            if (isAzureHostedRuntime()) {
                console.error('AI_CHAT_FUNCTION_URL is not set in Azure hosted runtime');
                return NextResponse.json({ error: 'AI proxy is not configured' }, { status: 503 });
            }

            // ローカル開発用: Gemini API 直接呼び出し
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
            }
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                systemInstruction: SYSTEM_PROMPT,
                generationConfig: {
                    responseMimeType: 'application/json',
                },
            });
            const result = await model.generateContent(prompt);
            responseText = result.response.text();
        }

        // JSON パース（Markdown コードブロック除去を含む）
        const cleaned = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
        let data;
        try {
            data = JSON.parse(cleaned);
        } catch (e) {
            console.error('JSON Parse Error:', responseText);
            return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Scoring API Error:', error);
        return NextResponse.json({ error: 'Scoring failed' }, { status: 500 });
    }
}