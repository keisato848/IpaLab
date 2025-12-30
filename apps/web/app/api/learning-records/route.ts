
import { NextRequest, NextResponse } from 'next/server';
import { containers } from '@/lib/services/cosmos';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Minimal Schema to validate incoming learning records
const LearningRecordSchema = z.object({
    id: z.string().optional(), // Should be UUID
    userId: z.string(),
    questionId: z.string(),
    examId: z.string(),
    category: z.string(),
    subCategory: z.string().optional(),
    isCorrect: z.boolean(),
    answeredAt: z.string().datetime().optional(), // ISO String
    timeTakenSeconds: z.number().optional(),
    nextReviewAt: z.string().datetime().optional(),
    reviewInterval: z.number().optional(),
    easeFactor: z.number().optional()
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const examId = searchParams.get('examId');
        const questionId = searchParams.get('questionId');

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        const container = containers.learningRecords;
        let query = "SELECT * FROM c WHERE c.userId = @userId";
        const parameters = [{ name: "@userId", value: userId }];

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
        const container = containers.learningRecords;

        if (Array.isArray(body)) {
            // Bulk Insert
            const parseResults = z.array(LearningRecordSchema).safeParse(body);
            if (!parseResults.success) {
                return NextResponse.json({ error: "Invalid data", details: parseResults.error.format() }, { status: 400 });
            }

            const records = parseResults.data;
            const savedRecords = [];

            // Note: Parallel execution might hit RU limits but simple for now. 
            // Consider bulk operations for large sets.
            for (const record of records) {
                // Ensure ID
                if (!record.id) record.id = crypto.randomUUID();
                if (!record.answeredAt) record.answeredAt = new Date().toISOString();

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

            const { resource } = await container.items.create(record);
            return NextResponse.json(resource, { status: 201 });
        }

    } catch (error: any) {
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
