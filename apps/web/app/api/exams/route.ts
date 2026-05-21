
import { NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';

export const dynamic = 'force-dynamic';

// 問題数集計のインメモリキャッシュ（RU節約のため）
let questionTotalsCache: { data: Map<string, number>; timestamp: number } | null = null;
const QUESTION_TOTALS_TTL_MS = 5 * 60 * 1000; // 5分

async function getQuestionTotals(): Promise<Map<string, number>> {
    if (questionTotalsCache && Date.now() - questionTotalsCache.timestamp < QUESTION_TOTALS_TTL_MS) {
        return questionTotalsCache.data;
    }

    const questionsContainer = await getContainer("Questions");
    const totals = new Map<string, number>();

    if (questionsContainer) {
        const { resources } = await questionsContainer.items.query<{
            examId: string;
            total: number;
        }>({
            query: "SELECT c.examId, COUNT(1) AS total FROM c GROUP BY c.examId"
        }).fetchAll();

        resources.forEach(({ examId, total }: { examId: string; total: number }) => {
            totals.set(examId, Number(total) || 0);
        });
    }

    questionTotalsCache = { data: totals, timestamp: Date.now() };
    return totals;
}

export async function GET() {
    try {
        const examsContainer = await getContainer("Exams");
        if (!examsContainer) throw new Error("Database not initialized");

        // Fetch all exams from the Exams container
        const { resources: exams } = await examsContainer.items
            .query("SELECT * FROM c ORDER BY c.id DESC")
            .fetchAll();

        const questionTotals = await getQuestionTotals();

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
        console.error("Failed to fetch exams:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
