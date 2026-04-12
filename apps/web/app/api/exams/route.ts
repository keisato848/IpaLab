
import { NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const examsContainer = await getContainer("Exams");
        if (!examsContainer) throw new Error("Database not initialized");

        const questionsContainer = await getContainer("Questions");

        // Fetch all exams from the Exams container
        const { resources: exams } = await examsContainer.items
            .query("SELECT * FROM c ORDER BY c.id DESC")
            .fetchAll();

        const questionTotals = new Map<string, number>();

        if (questionsContainer) {
            const { resources } = await questionsContainer.items.query<{
                examId: string;
                total: number;
            }>({
                query: "SELECT c.examId, COUNT(1) AS total FROM c GROUP BY c.examId"
            }).fetchAll();

            resources.forEach(({ examId, total }) => {
                questionTotals.set(examId, Number(total) || 0);
            });
        }

        const normalizedExams = exams.map((exam: any) => {
            const total = questionTotals.get(exam.id) ?? exam.stats?.total ?? 0;

            return {
                ...exam,
                stats: {
                    completed: exam.stats?.completed ?? 0,
                    correctRate: exam.stats?.correctRate ?? 0,
                    total,
                },
            };
        });

        return NextResponse.json(normalizedExams);
    } catch (error: any) {
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
