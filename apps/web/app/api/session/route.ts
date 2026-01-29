import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';
import { LearningSessionSchema, LearningSession } from '@ipa-lab/shared';
import { z } from 'zod';
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export const dynamic = 'force-dynamic';

// GET: List sessions for a user (optionally filtered by examId)
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get('examId');
        const status = searchParams.get('status'); // 'in-progress', 'completed', or null for all
        const limit = parseInt(searchParams.get('limit') || '50');

        const container = await getContainer("LearningSessions");
        if (!container) throw new Error("Database not initialized");

        let query = "SELECT * FROM c WHERE c.userId = @userId";
        const parameters: { name: string; value: string }[] = [
            { name: "@userId", value: session.user.id }
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
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
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
    const authSession = await getServerSession(authOptions);
    if (!authSession || !authSession.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const parseResult = UpdateSessionRequest.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: "Invalid request", details: parseResult.error.format() },
                { status: 400 }
            );
        }

        const { sessionId, answeredCount, correctCount, lastQuestionNo, status } = parseResult.data;

        const container = await getContainer("LearningSessions");
        if (!container) throw new Error("Database not initialized");

        // Fetch existing session
        const { resource: existingSession } = await container.item(sessionId, authSession.user.id).read();

        if (!existingSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // Check ownership
        if (existingSession.userId !== authSession.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

        const { resource } = await container.item(sessionId, authSession.user.id).replace(updatedSession);

        return NextResponse.json(resource, { status: 200 });

    } catch (error: any) {
        console.error("Failed to update session:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
