'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Question, LearningRecord, getLearningRecords } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import styles from './ExamResult.module.css';

interface ExamResultProps {
    questions: Question[];
    examId: string;
    year: string;
    type: string;
}

export default function ExamResult({ questions, examId, year, type }: ExamResultProps) {
    const { data: session, status } = useSession();
    const [records, setRecords] = useState<LearningRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadRecords() {
            setLoading(true);
            try {
                let fetchedRecords: LearningRecord[] = [];

                if (status === 'authenticated' && session?.user?.id) {
                    // Fetch from API
                    fetchedRecords = await getLearningRecords(session.user.id, examId);
                } else {
                    // Fetch from Guest LocalStorage
                    const fullHistory = guestManager.getHistory();
                    fetchedRecords = fullHistory.filter((r: LearningRecord) => r.examId === examId);
                }

                // Deduplicate? For now, we might have multiple attempts.
                // We want the *latest* attempt for each question.
                // Sort by answeredAt desc
                fetchedRecords.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());

                // Map latest per question
                const latestMap = new Map<string, LearningRecord>();
                fetchedRecords.forEach(r => {
                    if (!latestMap.has(r.questionId)) {
                        latestMap.set(r.questionId, r);
                    }
                });

                setRecords(Array.from(latestMap.values()));
            } catch (err) {
                console.error("Failed to load records", err);
            } finally {
                setLoading(false);
            }
        }

        if (status !== 'loading') {
            loadRecords();
        }
    }, [status, session, examId]);

    if (loading) {
        return <div className={styles.loading}>結果を集計中...</div>;
    }

    // Calculate Score
    let correctCount = 0;
    const totalCount = questions.length;

    const resultList = questions.map(q => {
        const record = records.find(r => r.questionId === q.id);
        const isCorrect = record?.isCorrect ?? false;
        if (isCorrect) correctCount++;

        return {
            ...q,
            isCorrect,
            answered: !!record,
            record
        };
    });

    const scorePercentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>実施結果: {year} {type}</h1>
            </header>

            <div className={styles.summaryCard}>
                <div className={styles.scoreCircle}>
                    <span className={styles.scoreVal}>{scorePercentage}%</span>
                    <span className={styles.scoreLabel}>正答率</span>
                </div>
                <div className={styles.stats}>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>正解数</span>
                        <span className={styles.statVal}>{correctCount} / {totalCount}</span>
                    </div>
                </div>
            </div>

            <div className={styles.details}>
                <h2>詳細</h2>
                <div className={styles.listHeader}>
                    <span className={styles.colNo}>No</span>
                    <span className={styles.colStatus}>結果</span>
                    <span className={styles.colTitle}>問題</span>
                    <span className={styles.colAction}>復習</span>
                </div>
                <div className={styles.listBody}>
                    {resultList.map(item => (
                        <div key={item.id} className={styles.listItem}>
                            <span className={styles.colNo}>Q{item.qNo}</span>
                            <span className={`${styles.colStatus} ${item.isCorrect ? styles.statusCorrect : (item.answered ? styles.statusIncorrect : styles.statusUnanswered)}`}>
                                {item.isCorrect ? '正解' : (item.answered ? '不正解' : '未回答')}
                            </span>
                            <span className={styles.colTitle}>{item.text.substring(0, 30)}...</span>
                            <span className={styles.colAction}>
                                <Link href={`/exam/${year}/${type}/${item.qNo}?mode=practice`} className={styles.reviewLink}>
                                    見直す
                                </Link>
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <footer className={styles.footer}>
                <Link href="/exam" className={styles.backBtn}>一覧に戻る</Link>
                <Link href={`/exam/${year}/${type}/1?mode=practice`} className={styles.retryBtn}>もう一度解く</Link>
            </footer>
        </div>
    );
}
