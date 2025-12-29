
import { NextRequest, NextResponse } from 'next/server';
import { containers } from '@/lib/services/cosmos';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { examId: string } }
) {
    try {
        const { examId } = params;
        if (!examId) {
            return NextResponse.json({ error: "Exam ID required" }, { status: 400 });
        }

        console.log(`Fetching questions for exam: ${examId}`);

        // Query CosmosDB
        const querySpec = {
            query: "SELECT * FROM c WHERE c.examId = @examId ORDER BY c.qNo ASC",
            parameters: [
                { name: "@examId", value: examId }
            ]
        };

        const { resources: questions } = await containers.questions.items.query(querySpec).fetchAll();

        console.log(`Found ${questions.length} questions for ${examId}`);

        return NextResponse.json(questions);
    } catch (error) {
        console.error("Failed to fetch questions:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
