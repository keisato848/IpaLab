import Link from 'next/link';
import { getQuestions } from '@/lib/api';
import ExamResult from '@/components/features/exam/ExamResult';

export default async function ExamResultPage({ params }: { params: { year: string; type: string } }) {
    const { year, type } = params;
    const examId = `${year}-${type === 'AM1' ? 'AM' : type}`;

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
