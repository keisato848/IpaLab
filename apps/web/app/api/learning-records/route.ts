
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
    selectedOptionId: z.string().optional(),
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
        if (!container) throw new Error("Database not initialized");

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
        console.error("Failed to fetch learning records:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const container = await getContainer("LearningRecords");
        if (!container) throw new Error("Database not initialized");
        const actualUserId = session.user.id;

        const saveRecord = async (record: z.infer<typeof LearningRecordSchema>) => {
            record.userId = actualUserId;

            if (!record.id) record.id = crypto.randomUUID();
            if (!record.answeredAt) record.answeredAt = new Date().toISOString();

            if (record.isDescriptive && record.aiScore !== undefined) {
                record.isCorrect = record.aiScore >= 60;
            }

            if (record.isCorrect === undefined) {
                record.isCorrect = false;
            }

            if (record.isFlagged === undefined) {
                record.isFlagged = false;
            }

            try {
                const { resource } = await container.items.create(record);
                return { resource, duplicated: false };
            } catch (error: any) {
                if (error?.code === 409) {
                    console.warn("Learning record already exists, treating as synced:", record.id);
                    return { resource: record, duplicated: true };
                }
                throw error;
            }
        };

        if (Array.isArray(body)) {
            // Bulk Insert
            const parseResults = z.array(LearningRecordSchema).safeParse(body);
            if (!parseResults.success) {
                return NextResponse.json({ error: "Invalid data", details: parseResults.error.format() }, { status: 400 });
            }

            const records = parseResults.data;
            const savedRecords = [];
            let duplicateCount = 0;

            for (const record of records) {
                const { resource, duplicated } = await saveRecord(record);
                savedRecords.push(resource);
                if (duplicated) duplicateCount++;
            }

            return NextResponse.json(
                { count: savedRecords.length, duplicateCount, records: savedRecords },
                { status: duplicateCount === savedRecords.length ? 200 : 201 }
            );

        } else {
            // Single Insert
            const result = LearningRecordSchema.safeParse(body);
            if (!result.success) {
                return NextResponse.json({ error: "Invalid data", details: result.error.format() }, { status: 400 });
            }

            const record = result.data;
            const { resource, duplicated } = await saveRecord(record);

            // [REMOVED] Cleanup Logic (Udemy-style history preservation)
            // We now keep all records linked to sessions.

            return NextResponse.json(resource, { status: duplicated ? 200 : 201 });
        }

    } catch (error: any) {
        console.error("Failed to save learning record(s):", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
