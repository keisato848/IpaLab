import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { getAppInsightsClient } from '@/lib/appinsights';

const apiKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEY_1 || "");
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
    try {
        // ... (lines 10-84)
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json(JSON.parse(responseText).plans);
    } catch (error: any) {
        console.error("AI Plan Generation Error:", error);

        const client = getAppInsightsClient();
        if (client) {
            client.trackException({ exception: error });
            client.trackTrace({ message: "Plan Generation Failed", severity: 3 });
        }

        return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
    }
}
