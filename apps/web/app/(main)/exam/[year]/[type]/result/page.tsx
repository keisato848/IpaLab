import Link from 'next/link';
import { getQuestions } from '@/lib/api';
import ExamResult from '@/components/features/exam/ExamResult';

export default async function ExamResultPage({ params }: { params: { year: string; type: string } }) {
    const { year, type } = params;

    // Construct Exam ID (Fix: Avoid duplicate suffixes like -AM-AM)
    // Same logic as QuestionPage
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    // Fetch Questions for reference
    const questions = await getQuestions(examId);

    return (
        <ExamResult
            questions={questions}
            examId={examId}
            year={year}
            type={type}
        />
    );
}
