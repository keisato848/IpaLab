
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // 動的レンダリングを強制
export const maxDuration = 60; // AI generation might take time
export const runtime = 'nodejs'; // Use Node runtime for stability

// Proxy to US region Function App to bypass Gemini API regional restrictions
const US_AI_FUNCTION_URL = process.env.AI_FUNCTION_URL || 'https://func-pm-exam-dx-ai-us.azurewebsites.net/api/ai/plan';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const response = await fetch(US_AI_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Plan generation failed:', error.message);
        return NextResponse.json({
            error: 'Failed to generate plan',
            details: error.message || String(error),
        }, { status: 500 });
    }
}
