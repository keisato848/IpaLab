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
    try {
        const data = await questionRepository.listByExamId(examId);
        questions = data as unknown as Question[];
    } catch (e) {
        // CosmosDB 失敗時は無視
    }

    // ファイルシステムフォールバック (ローカル開発・DB未接続時)
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
        } catch (e) {
            console.warn(`[Page] FS Data load failed for ${examId}.`);
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