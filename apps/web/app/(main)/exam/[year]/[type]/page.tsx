import Link from 'next/link';
import styles from './page.module.css';

import { getQuestions, Question } from '@/lib/api';
import { getExamLabel } from '@/lib/exam-utils';

export default async function ExamEntrancePage({ params }: { params: { year: string; type: string } }) {
    const { year, type } = params;

    // Construct Exam ID
    // If year param already contains full ID (e.g. AP-2024-Spring-AM), use it.
    // Otherwise construct it.
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;
    const examLabel = getExamLabel(examId);

    // Fetch Data
    const questions = await getQuestions(examId);

    // If no questions found (API likely offline or ID mismatch), show empty state or fallback
    // For MVP, we pass empty array.

    return (
        <div className={styles.container}>
            <div className={styles.breadcrumb}>
                <Link href="/exam">演習一覧</Link> &gt; {examLabel}
            </div>

            <header className={styles.header}>
                <h1>{examLabel}</h1>
                <p className={styles.description}>
                    モードを選択して開始してください。
                    <br />
                    練習モードでは一問ごとに正誤を確認できます。
                </p>
                <div className={styles.actions}>
                    <Link href={`/exam/${year}/${type}/1?mode=practice`} className={`${styles.btn} ${styles.btnPractice}`}>
                        練習モードで開始
                        <span className={styles.btnSub}>即座に解説を表示</span>
                    </Link>
                    <Link href={`/exam/${year}/${type}/1?mode=mock`} className={`${styles.btn} ${styles.btnMock}`}>
                        模擬試験モードで開始
                        <span className={styles.btnSub}>150分 / 80問</span>
                    </Link>
                </div>
            </header>

            <section className={styles.questionList}>
                <h2>問題一覧 ({questions.length}問)</h2>
                {questions.length === 0 ? (
                    <p className={styles.noData}>
                        問題データが見つかりません。<br />
                        バックエンドAPIが起動しているか、examId ({examId}) が正しいか確認してください。
                    </p>
                ) : (
                    <div className={styles.grid}>
                        {questions.map(q => (
                            <Link href={`/exam/${year}/${type}/${q.qNo}?mode=practice`} key={q.id} className={`${styles.qItem}`}>
                                <div className={styles.qHeader}>
                                    <span className={styles.qNo}>Q{q.qNo}</span>
                                    <span className={styles.qCat}>{q.subCategory || q.category}</span>
                                </div>
                                <p className={styles.qSummary}>{q.text.substring(0, 40)}...</p>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
