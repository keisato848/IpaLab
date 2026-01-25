
import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';
import { z } from 'zod';
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export const dynamic = 'force-dynamic';

// Minimal Schema to validate incoming learning records
const LearningRecordSchema = z.object({
    id: z.string().optional(), // Should be UUID
    userId: z.string(),
    questionId: z.string(),
    examId: z.string(),
    category: z.string(),
    subCategory: z.string().optional(),
    isCorrect: z.boolean().optional(), // Now optional
    isFlagged: z.boolean().optional(), // New: Review Flag
    sessionId: z.string().optional(), // New: Session Context
    answeredAt: z.string().datetime().optional(), // ISO String
    timeTakenSeconds: z.number().optional(),
    nextReviewAt: z.string().datetime().optional(),
    reviewInterval: z.number().optional(),
    easeFactor: z.number().optional(),

    // New fields for Descriptive Answers (AI Scoring)
    isDescriptive: z.boolean().optional(),
    aiScore: z.number().min(0).max(100).optional(),
    aiFeedback: z.string().optional(),
    aiRadarData: z.array(z.object({
        subject: z.string(),
        A: z.number(),
        fullMark: z.number()
    })).optional(),
    userAnswer: z.string().optional(),
    modelVersion: z.string().optional()
});

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId'); // This will be ignored in favor of session.user.id
        const examId = searchParams.get('examId');
        const questionId = searchParams.get('questionId');

        // Use userId from session for security
        const actualUserId = session.user.id;

        const container = await getContainer("LearningRecords"); // Updated container call
        let query = "SELECT * FROM c WHERE c.userId = @userId";
        const parameters = [{ name: "@userId", value: actualUserId }];

        if (examId) {
            query += " AND c.examId = @examId";
            parameters.push({ name: "@examId", value: examId });
        }

        if (questionId) {
            query += " AND c.questionId = @questionId";
            parameters.push({ name: "@questionId", value: questionId });
        }

        const { resources: records } = await container.items.query({
            query,
            parameters
        }).fetchAll();

        return NextResponse.json(records);

    } catch (error: any) {
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const container = await getContainer("LearningRecords");

        if (Array.isArray(body)) {
            // Bulk Insert
            const parseResults = z.array(LearningRecordSchema).safeParse(body);
            if (!parseResults.success) {
                return NextResponse.json({ error: "Invalid data", details: parseResults.error.format() }, { status: 400 });
            }

            const records = parseResults.data;
            const savedRecords = [];

            for (const record of records) {
                // Ensure ID
                if (!record.id) record.id = crypto.randomUUID();
                if (!record.answeredAt) record.answeredAt = new Date().toISOString();

                // Auto-determine isCorrect for descriptive
                if (record.isDescriptive) {
                    // Default logic: Score >= 60 is "Correct" (Passing)
                    if (record.aiScore !== undefined) {
                        record.isCorrect = record.aiScore >= 60;
                    }
                }

                // Fallback for isCorrect if still undefined (should be provided for non-descriptive)
                if (record.isCorrect === undefined) {
                    record.isCorrect = false;
                }

                const { resource } = await container.items.create(record);
                savedRecords.push(resource);
            }

            return NextResponse.json({ count: savedRecords.length, records: savedRecords }, { status: 201 });

        } else {
            // Single Insert
            const result = LearningRecordSchema.safeParse(body);
            if (!result.success) {
                return NextResponse.json({ error: "Invalid data", details: result.error.format() }, { status: 400 });
            }

            const record = result.data;
            if (!record.id) record.id = crypto.randomUUID();
            if (!record.answeredAt) record.answeredAt = new Date().toISOString();

            // Auto-determine isCorrect for descriptive
            if (record.isDescriptive) {
                if (record.aiScore !== undefined) {
                    record.isCorrect = record.aiScore >= 60;
                }
            }

            // Fallback for isCorrect
            if (record.isCorrect === undefined) {
                record.isCorrect = false;
            }

            // Session & Status Fields
            if (record.sessionId) {
                // Logic to validate session exists if needed, but for now just save it
            }
            if (record.isFlagged === undefined) {
                record.isFlagged = false;
            }

            const { resource } = await container.items.create(record);

            // [REMOVED] Cleanup Logic (Udemy-style history preservation)
            // We now keep all records linked to sessions.

            return NextResponse.json(resource, { status: 201 });
        }

    } catch (error: any) {
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
