import { Suspense } from 'react';
import { getExams, Exam } from '@/lib/api';
import ExamListClient from '@/components/features/exam/ExamListClient';
import styles from './page.module.css';

// Enable ISR with 1 hour revalidation for exam list
export const revalidate = 3600;

export const metadata = {
    title: '演習・模擬試験',
    description: '情報処理技術者試験の過去問題を選択して学習を開始しましょう。',
};

export default async function ExamListPage() {
    // Server-side data fetching with fallback for build time
    // During build (SSG), API may not be available, so we provide empty array
    // Client will fetch fresh data on mount
    let exams: Exam[] = [];
    try {
        exams = await getExams();
    } catch {
        // Build time or API unavailable - client will fetch on mount
        // eslint-disable-next-line no-console
        console.log('SSG: API unavailable, will fetch on client');
    }

    return (
        <Suspense fallback={<div className={styles.container}><p>読み込み中...</p></div>}>
            <ExamListClient initialExams={exams} />
        </Suspense>
    );
}
