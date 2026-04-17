import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

/**
 * AIアシスタント チャット用の US リージョン Function App エンドポイント。
 *
 * Gemini API は East Asia から直接呼び出せないため、
 * AI_CHAT_FUNCTION_URL が設定されている場合は US Function を経由する。
 * 未設定の場合は直接呼び出しにフォールバック（ローカル開発用）。
 */
const AI_CHAT_FUNCTION_URL = process.env.AI_CHAT_FUNCTION_URL;

function getGenAI(): GoogleGenerativeAI {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY が設定されていません');
    }
    return new GoogleGenerativeAI(apiKey);
}

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

/**
 * チャット応答をストリーミング風に返す AsyncGenerator。
 *
 * - AI_CHAT_FUNCTION_URL が設定されていれば US Function 経由で non-streaming に取得し、
 *   token 単位に分割して yield する（Gemini East Asia リージョン制限回避）。
 * - 未設定時は直接 Gemini API を呼び出して generateContentStream を yield する（ローカル開発用）。
 */
export async function* streamChatResponse(
    systemPrompt: string,
    userMessage: string,
): AsyncGenerator<string> {
    if (AI_CHAT_FUNCTION_URL) {
        yield* proxyChatResponse(systemPrompt, userMessage);
        return;
    }

    const model = getGenAI().getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
        safetySettings,
    });

    const result = await model.generateContentStream(userMessage);

    for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
            yield text;
        }
    }
}

async function* proxyChatResponse(
    systemPrompt: string,
    userMessage: string,
): AsyncGenerator<string> {
    const response = await fetch(AI_CHAT_FUNCTION_URL as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userMessage }),
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`AI chat proxy failed: ${response.status} ${errBody}`);
    }

    const data = (await response.json()) as { text?: string; error?: string };
    if (data.error) {
        throw new Error(data.error);
    }
    const text = data.text ?? '';
    if (!text) {
        return;
    }

    // 擬似ストリーミング: 約40文字単位で分割して yield（UI の見た目を滑らかに保つ）
    const CHUNK_SIZE = 40;
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        yield text.slice(i, i + CHUNK_SIZE);
    }
}
