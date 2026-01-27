
import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';
import { LearningSessionSchema } from '@ipa-lab/shared';
import { z } from 'zod';
import { getAppInsightsClient } from '@/lib/appinsights';

export const dynamic = 'force-dynamic';

// Schema for request body (subset of LearningSession)
const CreateSessionRequest = z.object({
    userId: z.string(),
    examId: z.string(),
    mode: z.enum(['practice', 'mock']),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const parseResult = CreateSessionRequest.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json(
                { error: "Invalid request", details: parseResult.error.format() },
                { status: 400 }
            );
        }

        const { userId, examId, mode } = parseResult.data;

        const newSession = {
            id: crypto.randomUUID(),
            userId,
            examId,
            mode,
            startedAt: new Date().toISOString(),
            status: 'in-progress'
        };

        // Validate against full model just in case
        const sessionData = LearningSessionSchema.parse(newSession);

        const container = await getContainer("LearningSessions");
        if (!container) throw new Error("Database not initialized");
        const { resource } = await container.items.create(sessionData);

        return NextResponse.json(resource, { status: 201 });

    } catch (error: any) {
        console.error("Failed to create session:", error);

        const client = getAppInsightsClient();
        if (client) {
            client.trackException({ exception: error });
        }

        return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }
}
