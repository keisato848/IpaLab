import { Suspense } from 'react';
import { getExams } from '@/lib/api';
import ExamListClient from '@/components/features/exam/ExamListClient';
import styles from './page.module.css';

// Enable ISR with 1 hour revalidation for exam list
export const revalidate = 3600;

export const metadata = {
    title: '演習・模擬試験',
    description: '情報処理技術者試験の過去問題を選択して学習を開始しましょう。',
};

export default async function ExamListPage() {
    // Server-side data fetching - no client-side loading state needed
    const exams = await getExams();

    return (
        <Suspense fallback={<div className={styles.container}><p>読み込み中...</p></div>}>
            <ExamListClient initialExams={exams} />
        </Suspense>
    );
}
