
import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';

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

        const container = await getContainer("Questions");
        if (!container) throw new Error("Database not available");
        const { resources: questions } = await container.items.query(querySpec).fetchAll();

        // Safety: Inject category if missing (Critical for AM exams where it might be omitted in raw data)
        const safeQuestions = questions.map((q: any) => ({
            ...q,
            category: q.category || examId.split('-')[0], // Fallback to exam prefix (e.g. PM, AP)
            // Ensure other potentially missing fields
            subCategory: q.subCategory || "その他", // Fallback
        }));

        return NextResponse.json(safeQuestions);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
