'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { LearningRecord, getLearningRecords } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
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
                fetchedRecords.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
                setRecords(fetchedRecords);
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
            <div className={styles.headerRow}>
                <div className={styles.colDate}>日時</div>
                <div className={styles.colExam}>試験区分</div>
                <div className={styles.colQuestion}>問題</div>
                <div className={styles.colResult}>結果</div>
            </div>
            <div className={styles.list}>
                {records.map((r, i) => (
                    <div key={i} className={styles.row}>
                        <div className={styles.colDate}>
                            {new Date(r.answeredAt).toLocaleString('ja-JP')}
                        </div>
                        <div className={styles.colExam}>
                            {r.examId}
                        </div>
                        <div className={styles.colQuestion}>
                            Q{/* Note: record might not have qNo if older Schema, lookup usually needed or save qNo. 
                               For now, we rely on QuestionID or add qNo to Record. 
                               Let's assume QuestionID contains helpful info or link. */}
                            {/* Assuming questionId format examId-qNo */}
                            {r.questionId.split('-').pop()}
                        </div>
                        <div className={styles.colResult}>
                            <span className={r.isCorrect ? styles.tagCorrect : styles.tagIncorrect}>
                                {r.isCorrect ? '正解' : '不正解'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
