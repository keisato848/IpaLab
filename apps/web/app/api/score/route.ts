import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAiChatAuthHeaders } from '@/lib/ai-chat-auth';

export const runtime = 'nodejs';

// --- Zod スキーマ定義 ---
const RadarDataSchema = z.object({
    subject: z.string(),
    A: z.number().transform(value => Math.max(0, Math.min(10, value))),
    fullMark: z.number(),
});

const ScoringResultSchema = z.object({
    score: z.number().int().min(0).max(100),
    radarChartData: z.array(RadarDataSchema).min(1),
    feedback: z.string(),
    mermaidDiagram: z.string().optional().default(''),
    improvedAnswer: z.string().optional().default(''),
});

type ScoringResult = z.infer<typeof ScoringResultSchema>;
type StructuredAiError = Error & { httpStatus?: number; isConfig?: boolean };

/**
 * AI レスポンステキストから JSON 部分を安全に抽出する。
 * Markdown コードフェンスや前後のテキストを除去して JSON オブジェクトだけを返す。
 */
function extractJson(text: string): string {
    let cleaned = text.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
    }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
    }
    return cleaned;
}

/**
 * AI レスポンスを JSON パース → Zod スキーマ検証する。
 * SyntaxError または ZodError はそのままスローする。
 */
function parseAndValidate(rawText: string): ScoringResult {
    const cleaned = extractJson(rawText);
    const parsed = JSON.parse(cleaned);
    return ScoringResultSchema.parse(parsed);
}

function buildStructuredAiErrorResponse(err: unknown): NextResponse | null {
    const e = err as StructuredAiError;
    if (typeof e.httpStatus === 'number') {
        return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    }
    return null;
}

/**
 * スキーマ不一致時に AI への補正プロンプトを生成する。
 */
function buildCorrectionPrompt(originalResponse: string, error: string): string {
    return `前の応答にJSON形式の問題がありました。以下のJSON構造のみを純粋なJSONとして再出力してください。Markdownブロックや余分な文章は不要です。

エラー: ${error.slice(0, 300)}

前の応答（参考）: ${originalResponse.slice(0, 400)}

以下の構造で正確に出力してください:
{
  "score": 0-100の整数,
  "radarChartData": [
    { "subject": "設問適合性", "A": 0-10の点数, "fullMark": 10 },
    { "subject": "論理構成", "A": 0-10の点数, "fullMark": 10 },
    { "subject": "重要語句", "A": 0-10の点数, "fullMark": 10 },
    { "subject": "具体性", "A": 0-10の点数, "fullMark": 10 }
  ],
  "feedback": "具体的な改善点を含むフィードバック",
  "mermaidDiagram": "graph TD; A[現状] --> B[改善策]",
  "improvedAnswer": "CLKSを満たした改善回答例"
}`;
}

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
        const aiChatFunctionUrl = getAiChatFunctionUrl();

        // AI 呼び出しヘルパー（初回・リトライ共用）
        const callAi = async (userMessage: string): Promise<string> => {
            if (aiChatFunctionUrl) {
                // 本番: US Azure Function 経由（East Asia から Gemini への地域制限を回避）
                const requestBody = JSON.stringify({ systemPrompt: SYSTEM_PROMPT, userMessage });
                let authHeaders: Record<string, string>;
                try {
                    authHeaders = createAiChatAuthHeaders(requestBody);
                } catch {
                    console.error('AI_CHAT_FUNCTION_SECRET is not set for AI proxy request');
                    throw Object.assign(
                        new Error('AI proxy authentication is not configured'),
                        { httpStatus: 503 },
                    );
                }
                const res = await fetch(aiChatFunctionUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                    body: requestBody,
                });
                if (!res.ok) {
                    throw new Error(`AI proxy failed: ${res.status} ${await res.text().catch(() => '')}`);
                }
                const json = (await res.json()) as { text?: string; error?: string };
                if (json.error) throw new Error(json.error);
                return json.text ?? '';
            } else {
                if (isAzureHostedRuntime()) {
                    console.error('AI_CHAT_FUNCTION_URL is not set in Azure hosted runtime');
                    throw Object.assign(
                        new Error('AI proxy is not configured'),
                        { httpStatus: 503 },
                    );
                }
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    throw Object.assign(
                        new Error('GEMINI_API_KEY is not set'),
                        { httpStatus: 500, isConfig: true },
                    );
                }
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    systemInstruction: SYSTEM_PROMPT,
                    generationConfig: { responseMimeType: 'application/json' },
                });
                const result = await model.generateContent(userMessage);
                return result.response.text();
            }
        };

        // AI 呼び出し（初回）
        let responseText: string;
        try {
            responseText = await callAi(prompt);
        } catch (err: unknown) {
            console.error('Scoring API Error:', err);
            const structuredErrorResponse = buildStructuredAiErrorResponse(err);
            if (structuredErrorResponse) return structuredErrorResponse;
            return NextResponse.json({ error: 'Scoring failed' }, { status: 500 });
        }

        // Zod スキーマ検証（失敗時は補正プロンプトで1回リトライ）
        let scoringResult: ScoringResult;
        try {
            scoringResult = parseAndValidate(responseText);
        } catch (firstErr: unknown) {
            const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
            console.warn(`[Score] AI response validation failed, retrying. Error: ${errMsg.slice(0, 200)}`);
            let retryText: string;
            try {
                retryText = await callAi(buildCorrectionPrompt(responseText, errMsg));
            } catch (retryErr: unknown) {
                console.error('Scoring API Retry Error:', retryErr);
                const structuredErrorResponse = buildStructuredAiErrorResponse(retryErr);
                if (structuredErrorResponse) return structuredErrorResponse;
                return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
            }
            try {
                scoringResult = parseAndValidate(retryText);
            } catch {
                console.error('JSON Parse Error:', responseText);
                return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
            }
        }

        return NextResponse.json(scoringResult);
    } catch (error: unknown) {
        console.error('Scoring API Error:', error);
        return NextResponse.json({ error: 'Scoring failed' }, { status: 500 });
    }
}