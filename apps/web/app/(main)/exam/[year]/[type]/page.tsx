import { Suspense } from 'react';
import { getQuestions, Question } from '@/lib/api';
import { getExamLabel } from '@/lib/exam-utils';
import { getExamData } from '@/lib/ssg-helper';
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
    if (questions.length === 0) {
        try {
            const fsData = await getExamData(examId);
            if (fsData && !Array.isArray(fsData)) {
                if ('qNo' in fsData) {
                    // Form B: 単一問題オブジェクト
                    questions = [fsData] as unknown as Question[];
                } else if ('questions' in fsData) {
                    // Form C: ラッパーオブジェクト
                    questions = (fsData as any).questions as Question[];
                }
            } else if (Array.isArray(fsData)) {
                // Form A: 配列
                questions = fsData as unknown as Question[];
            }
            if (questions.length > 0) {
                console.warn(
                    `[Page] Filesystem fallback engaged for examId=${examId} (loaded ${questions.length} questions). ` +
                    `cosmosFailed=${cosmosFailed}. Investigate sync gap or DB outage.`
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