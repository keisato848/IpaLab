import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

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

export async function* streamChatResponse(
    systemPrompt: string,
    userMessage: string,
): AsyncGenerator<string> {
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
