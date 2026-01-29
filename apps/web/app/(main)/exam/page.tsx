import { Suspense } from 'react';
import ExamListClient from '@/components/features/exam/ExamListClient';
import styles from './page.module.css';

// Use dynamic rendering to avoid SSG build-time API calls
// This ensures the page works in CI/CD without API server
export const dynamic = 'force-dynamic';

export const metadata = {
    title: '演習・模擬試験',
    description: '情報処理技術者試験の過去問題を選択して学習を開始しましょう。',
};

export default async function ExamListPage() {
    // Don't fetch on server during build - let client handle it
    // This avoids localhost:3001 connection errors in CI/CD
    return (
        <Suspense fallback={<div className={styles.container}><p>読み込み中...</p></div>}>
            <ExamListClient initialExams={[]} />
        </Suspense>
    );
}
