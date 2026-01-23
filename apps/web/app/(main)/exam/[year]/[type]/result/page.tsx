import Link from 'next/link';
import { getQuestions, Question } from '@/lib/api';
import ExamResult from '@/components/features/exam/ExamResult';
import { questionRepository } from '@/lib/repositories/questionRepository';

export const dynamicParams = true;

export default async function ExamResultPage({ params }: { params: { year: string; type: string } }) {
    const { year, type } = params;

    // Construct Exam ID
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    // Fetch Questions using DB
    let questions: Question[] = [];
    try {
        const data = await questionRepository.listByExamId(examId);
        questions = data as unknown as Question[];
    } catch (e) {
        console.warn(`[ResultPage] DB fetch failed for ${examId}`, e);
        // Fallback or empty logic if needed
    }

    return (
        <ExamResult
            questions={questions}
            examId={examId}
            year={year}
            type={type}
        />
    );
}