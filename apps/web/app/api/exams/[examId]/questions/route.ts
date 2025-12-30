
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

        // Query CosmosDB
        const querySpec = {
            query: "SELECT * FROM c WHERE c.examId = @examId ORDER BY c.qNo ASC",
            parameters: [
                { name: "@examId", value: examId }
            ]
        };

        const { resources: questions } = await containers.questions.items.query(querySpec).fetchAll();

        return NextResponse.json(questions);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
