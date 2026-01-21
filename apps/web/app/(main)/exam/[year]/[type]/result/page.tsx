import Link from 'next/link';
import { getQuestions, Question } from '@/lib/api';
import ExamResult from '@/components/features/exam/ExamResult';
import { generateAllExamParams, getExamData } from '@/lib/ssg-helper';

/*
export async function generateStaticParams() {
    return generateAllExamParams();
}
*/

export const dynamicParams = true;

export default async function ExamResultPage({ params }: { params: { year: string; type: string } }) {
    const { year, type } = params;

    // Construct Exam ID
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    // Fetch Questions using FS for SSG
    let questions: Question[] = [];
    try {
        const data = await getExamData(examId);
        questions = data as unknown as Question[];
    } catch (e) {
        // Fallback to API if FS fails (runtime) or empty
        console.warn(`[ResultPage] FS fetch failed for ${examId}, falling back to API`);
        try {
            questions = await getQuestions(examId);
        } catch (apiErr) {
            console.error(`[ResultPage] API fetch also failed for ${examId}`);
        }
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