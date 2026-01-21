'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { LearningRecord, getLearningRecords } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import { getExamLabel } from '@/lib/exam-utils';
import styles from './HistoryList.module.css';

export default function HistoryList() {
    const { data: session, status } = useSession();
    const [records, setRecords] = useState<LearningRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadRecords() {
            setLoading(true);
            try {
                let fetchedRecords: LearningRecord[] = [];

                if (status === 'authenticated' && session?.user?.id) {
                    fetchedRecords = await getLearningRecords(session.user.id);
                } else {
                    fetchedRecords = guestManager.getHistory();
                }

                // Sort by answeredAt desc
                const recordsWithTimestamp = fetchedRecords.map(r => ({
                    ...r,
                    answeredTimestamp: new Date(r.answeredAt).getTime()
                }));
                recordsWithTimestamp.sort((a, b) => b.answeredTimestamp - a.answeredTimestamp);
                setRecords(recordsWithTimestamp);
            } catch (err) {
                console.error("Failed to load records", err);
            } finally {
                setLoading(false);
            }
        }

        if (status !== 'loading') {
            loadRecords();
        }
    }, [status, session]);

    if (loading) {
        return <div className={styles.loading}>読み込み中...</div>;
    }

    if (records.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>学習履歴がありません。</p>
                <Link href="/exam" className={styles.startBtn}>学習を開始する</Link>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {records.map((r, i) => (
                <div key={i} className={styles.historyCard}>
                    <div className={styles.cardMain}>
                        <div className={styles.examTitle}>
                            {getExamLabel(r.examId)}
                        </div>
                        <div className={styles.questionInfo}>
                            <span>問題 {r.questionId.split('-').pop()}</span>
                            <span className={r.isCorrect ? styles.tagCorrect : styles.tagIncorrect}>
                                {r.isCorrect ? (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        正解
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                        不正解
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                    <div className={styles.cardMeta}>
                        <div className={styles.date}>
                            {new Date(r.answeredAt).toLocaleString('ja-JP')}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
