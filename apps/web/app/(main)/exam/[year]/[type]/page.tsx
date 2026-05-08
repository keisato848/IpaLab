import { Suspense } from 'react';
import { Question } from '@/lib/api';
import { getExamLabel } from '@/lib/exam-utils';
import { hasSuspiciousPlaceholderQuestions, loadFilesystemQuestions } from '@/lib/exam-data';
import ExamEntranceClient from '@/components/features/exam/ExamEntranceClient';
import { questionRepository } from '@/lib/repositories/questionRepository';

export const dynamic = 'force-dynamic';
export const dynamicParams = true; // Allow new exams not built yet (ISR)
export const revalidate = 3600;

export default async function ExamEntrancePage({ params }: { params: Promise<{ year: string; type: string }> }) {
    const { year, type } = await params;

    // Construct Exam ID
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;
    const examLabel = getExamLabel(examId);

    // Fetch Data
    let questions: Question[] = [];
    let cosmosFailed = false;
    try {
        const data = await questionRepository.listByExamId(examId);
        questions = data as unknown as Question[];
    } catch (e) {
        cosmosFailed = true;
        console.error(`[Page] Cosmos query failed for examId=${examId}:`, e instanceof Error ? e.message : e);
    }

    // Filesystem フォールバック: 全環境で有効。Cosmos 同期漏れ・接続障害時の最終防衛線。
    // observability: fallback が発動した場合は warn を出して根本原因の追跡可能性を確保する。
    const suspiciousPlaceholderQuestions = hasSuspiciousPlaceholderQuestions(examId, questions);
    if (questions.length === 0 || suspiciousPlaceholderQuestions) {
        try {
            const cosmosQuestionCount = questions.length;
            const fsQuestions = await loadFilesystemQuestions(examId);
            if (fsQuestions.length > 0) {
                questions = fsQuestions;
                console.warn(
                    `[Page] Filesystem fallback engaged for examId=${examId} (loaded ${questions.length} questions). ` +
                    `cosmosFailed=${cosmosFailed}, cosmosTotal=${cosmosQuestionCount}, suspiciousPlaceholder=${suspiciousPlaceholderQuestions}. ` +
                    `Investigate sync gap, stale qNo, or DB outage.`
                );
            }
        } catch (e) {
            console.warn(`[Page] FS Data load failed for ${examId}:`, e instanceof Error ? e.message : e);
        }
    }

    return (
        <Suspense fallback={<div>Loading exam data...</div>}>
            <ExamEntranceClient
                year={year}
                type={type}
                examId={examId}
                examLabel={examLabel}
                questions={questions}
            />
        </Suspense>
    );
}