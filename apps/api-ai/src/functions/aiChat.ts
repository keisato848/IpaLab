import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

interface ChatRequest {
    systemPrompt: string;
    userMessage: string;
}

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

/**
 * AIアシスタントのチャット応答を生成する Azure Function。
 *
 * Gemini API は East Asia リージョンから直接呼び出せないため、
 * この US リージョンの Function を経由することで地域制限を回避する。
 *
 * リクエスト: { systemPrompt, userMessage }
 * レスポンス: { text }  （non-streaming）
 */
export async function aiChat(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log("AI Chat request received");

    try {
        const apiKey = process.env.GEMINI_API_KEY || "";
        if (!apiKey) {
            return { status: 500, jsonBody: { error: "API Key not configured" } };
        }

        const body: ChatRequest = (await request.json()) as ChatRequest;
        const { systemPrompt, userMessage } = body || ({} as ChatRequest);

        if (!systemPrompt || !userMessage || typeof systemPrompt !== "string" || typeof userMessage !== "string") {
            return { status: 400, jsonBody: { error: "Missing systemPrompt or userMessage" } };
        }
        if (userMessage.length > 8000 || systemPrompt.length > 16000) {
            return { status: 400, jsonBody: { error: "Prompt too long" } };
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        let lastError: unknown = null;
        for (const modelName of MODELS) {
            try {
                context.log(`Trying model: ${modelName}`);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: systemPrompt,
                    safetySettings,
                });

                const result = await model.generateContent(userMessage);
                const text = result.response.text();

                if (text) {
                    return { status: 200, jsonBody: { text, model: modelName } };
                }
                lastError = new Error("Empty response");
            } catch (err) {
                context.log(`Model ${modelName} failed:`, err instanceof Error ? err.message : String(err));
                lastError = err;
            }
        }

        return {
            status: 502,
            jsonBody: {
                error: "All models failed",
                details: lastError instanceof Error ? lastError.message : String(lastError),
            },
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.log("aiChat error:", message);
        return { status: 500, jsonBody: { error: "Internal error", details: message } };
    }
}

app.http("aiChat", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "ai/chat",
    handler: aiChat,
});
