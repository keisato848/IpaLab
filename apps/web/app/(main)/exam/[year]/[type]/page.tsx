import { Suspense } from 'react';
import { getQuestions, Question } from '@/lib/api';
import { getExamLabel } from '@/lib/exam-utils';
import ExamEntranceClient from '@/components/features/exam/ExamEntranceClient';
import { questionRepository } from '@/lib/repositories/questionRepository';

export const dynamic = 'force-dynamic';
export const dynamicParams = true; // Allow new exams not built yet (ISR)
export const revalidate = 3600;

export default async function ExamEntrancePage({ params }: { params: { year: string; type: string } }) {
    const { year, type } = params;

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
        // Fallback or empty
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