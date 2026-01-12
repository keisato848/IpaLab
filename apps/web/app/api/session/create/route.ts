
import { NextRequest, NextResponse } from 'next/server';
import { containers } from '@/lib/services/cosmos';
import { LearningSessionSchema } from '@ipa-lab/shared';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema for request body (subset of LearningSession)
const CreateSessionRequest = z.object({
    userId: z.string(),
    examId: z.string(),
    mode: z.enum(['practice', 'mock']),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

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

        const container = containers.learningSessions;
        const { resource } = await container.items.create(sessionData);

        return NextResponse.json(resource, { status: 201 });

    } catch (error: any) {
        console.error("Failed to create session:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
