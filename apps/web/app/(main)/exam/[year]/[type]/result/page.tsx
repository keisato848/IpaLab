import { Question } from '@/lib/api';
import ExamResult from '@/components/features/exam/ExamResult';
import { questionRepository } from '@/lib/repositories/questionRepository';
import { hasSuspiciousPlaceholderQuestions, loadFilesystemQuestions } from '@/lib/exam-data';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default async function ExamResultPage({ params }: { params: Promise<{ year: string; type: string }> }) {
    const { year, type } = await params;

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
    }

    const suspiciousPlaceholderQuestions = hasSuspiciousPlaceholderQuestions(examId, questions);
    if (questions.length === 0 || suspiciousPlaceholderQuestions) {
        try {
            const fsQuestions = await loadFilesystemQuestions(examId);
            if (fsQuestions.length > 0) {
                console.warn(
                    `[ResultPage] Filesystem fallback engaged for examId=${examId} (loaded ${fsQuestions.length} questions). ` +
                    `cosmosTotal=${questions.length}, suspiciousPlaceholder=${suspiciousPlaceholderQuestions}.`
                );
                questions = fsQuestions;
            }
        } catch (e) {
            console.warn(`[ResultPage] FS Data load failed for ${examId}:`, e instanceof Error ? e.message : e);
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