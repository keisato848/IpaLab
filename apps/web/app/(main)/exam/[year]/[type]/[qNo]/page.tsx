import Link from 'next/link';
import { getQuestions } from '@/lib/api';
import QuestionClient from '@/components/features/exam/QuestionClient';
import styles from './page.module.css';

export default async function ExamQuestionPage({ params }: { params: { year: string; type: string; qNo: string } }) {
    const { year, type, qNo } = params;

    // Construct Exam ID
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    // Fetch Questions
    const questions = await getQuestions(examId);

    // Find current question by qNo
    // Note: qNo is 1-based index usually, but data might use different ID. 
    // Assuming qNo maps to index+1 if qNo property matches.
    const qNoInt = parseInt(qNo);
    const question = questions.find(q => q.qNo === qNoInt);

    if (!question) {
        return (
            <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1>問題が見つかりません (Q{qNo})</h1>
                    <p>番号が正しいか確認してください。</p>
                    <Link href={`/exam/${year}/${type}`} style={{ color: '#0070f3', textDecoration: 'underline' }}>
                        問題一覧に戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <QuestionClient
            question={question}
            year={year}
            type={type}
            qNo={qNo}
            totalQuestions={questions.length}
        />
    );
}
