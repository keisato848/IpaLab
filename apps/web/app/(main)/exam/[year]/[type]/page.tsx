import { getQuestions } from '@/lib/api';
import { getExamLabel } from '@/lib/exam-utils';
import ExamEntranceClient from '@/components/features/exam/ExamEntranceClient';

export default async function ExamEntrancePage({ params }: { params: { year: string; type: string } }) {
    const { year, type } = params;

    // Construct Exam ID
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;
    const examLabel = getExamLabel(examId);

    // Fetch Data
    const questions = await getQuestions(examId);

    return (
        <ExamEntranceClient
            year={year}
            type={type}
            examId={examId}
            examLabel={examLabel}
            questions={questions}
        />
    );
}
