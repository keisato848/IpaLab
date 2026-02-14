import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';
import { LearningSessionSchema, LearningSession } from '@ipa-lab/shared';
import { z } from 'zod';
import { requireAuth, checkDbContainer, errorResponse, notFoundResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// GET: List sessions for a user (optionally filtered by examId)
export async function GET(request: NextRequest) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get('examId');
        const status = searchParams.get('status'); // 'in-progress', 'completed', or null for all
        const limit = parseInt(searchParams.get('limit') || '50');

        const container = await getContainer("LearningSessions");
        const dbError = checkDbContainer(container);
        if (dbError) return dbError;

        let query = "SELECT * FROM c WHERE c.userId = @userId";
        const parameters: { name: string; value: string }[] = [
            { name: "@userId", value: auth.session.user.id }
        ];

        if (examId) {
            query += " AND c.examId = @examId";
            parameters.push({ name: "@examId", value: examId });
        }

        if (status) {
            query += " AND c.status = @status";
            parameters.push({ name: "@status", value: status });
        }

        query += " ORDER BY c.startedAt DESC";

        const { resources } = await container.items.query({
            query,
            parameters
        }).fetchAll();

        // Return limited results
        const sessions = resources.slice(0, limit) as LearningSession[];

        return NextResponse.json(sessions, { status: 200 });

    } catch (error: any) {
        console.error("Failed to fetch sessions:", error);
        return errorResponse(`Internal Server Error: ${error.message}`);
    }
}

// PATCH: Update session progress
const UpdateSessionRequest = z.object({
    sessionId: z.string().uuid(),
    answeredCount: z.number().int().min(0).optional(),
    correctCount: z.number().int().min(0).optional(),
    lastQuestionNo: z.number().int().min(0).optional(),
    status: z.enum(['in-progress', 'completed']).optional(),
});

export async function PATCH(request: NextRequest) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    try {
        const body = await request.json();
        const parseResult = UpdateSessionRequest.safeParse(body);

        if (!parseResult.success) {
            return errorResponse(`Invalid request: ${JSON.stringify(parseResult.error.format())}`, 400);
        }

        const { sessionId, answeredCount, correctCount, lastQuestionNo, status } = parseResult.data;

        const container = await getContainer("LearningSessions");
        const dbError = checkDbContainer(container);
        if (dbError) return dbError;

        // Fetch existing session
        const { resource: existingSession } = await container.item(sessionId, auth.session.user.id).read();

        if (!existingSession) {
            return notFoundResponse("Session not found");
        }

        // Check ownership
        if (existingSession.userId !== auth.session.user.id) {
            return errorResponse("Forbidden", 403);
        }

        // Update fields
        const updatedSession = {
            ...existingSession,
            ...(answeredCount !== undefined && { answeredCount }),
            ...(correctCount !== undefined && { correctCount }),
            ...(lastQuestionNo !== undefined && { lastQuestionNo }),
            ...(status && { status }),
            ...(status === 'completed' && { completedAt: new Date().toISOString() }),
        };

        const { resource } = await container.item(sessionId, auth.session.user.id).replace(updatedSession);

        return NextResponse.json(resource, { status: 200 });

    } catch (error: any) {
        console.error("Failed to update session:", error);
        return errorResponse(`Internal Server Error: ${error.message}`);
    }
}
