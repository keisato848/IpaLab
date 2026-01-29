'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Question, LearningRecord, getLearningRecords, createLearningSession } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import { getExamLabel } from '@/lib/exam-utils';
import styles from './ExamResult.module.css';

interface ExamResultProps {
    questions: Question[];
    examId: string;
    year: string;
    type: string;
}

export default function ExamResult({ questions, examId, year, type }: ExamResultProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId');
    
    const [records, setRecords] = useState<LearningRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);

    useEffect(() => {
        async function loadRecords() {
            setLoading(true);
            try {
                let fetchedRecords: LearningRecord[] = [];

                if (status === 'authenticated' && session?.user?.id) {
                    fetchedRecords = await getLearningRecords(session.user.id, examId);
                } else {
                    const fullHistory = guestManager.getHistory();
                    fetchedRecords = fullHistory.filter((r: LearningRecord) => r.examId === examId);
                }

                // If sessionId provided, filter by session
                if (sessionId) {
                    const sessionRecords = fetchedRecords.filter(r => r.sessionId === sessionId);
                    if (sessionRecords.length > 0) {
                        fetchedRecords = sessionRecords;
                    }
                }

                // Get latest record per question
                // Sort by answeredAt desc (newest first)
                fetchedRecords.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());

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
    }, [status, session, examId, sessionId]);

    // Start a new session (retest)
    const handleNewSession = async (mode: 'practice' | 'mock') => {
        setIsStarting(true);
        try {
            const userId = session?.user?.id || guestManager.getGuestId();
            if (!userId) {
                router.push('/login');
                return;
            }

            let newSessionId: string | undefined;
            if (session?.user?.id) {
                const newSession = await createLearningSession(userId, examId, mode, questions.length);
                newSessionId = newSession?.id;
            }

            const targetUrl = `/exam/${year}/${type}/1?mode=${mode}${newSessionId ? `&sessionId=${newSessionId}` : ''}`;
            router.push(targetUrl);
        } catch (err) {
            console.error("Failed to start new session", err);
        } finally {
            setIsStarting(false);
        }
    };

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
    const examLabel = getExamLabel(examId);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>{examLabel} 実施結果</h1>
            </header>

            <div className={styles.summaryCard}>
                <div className={styles.scoreCircle}>
                    <span className={styles.scoreVal}>{scorePercentage}<span style={{ fontSize: '1.5rem' }}>%</span></span>
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
                <div className={styles.resultList}>
                    {resultList.map(item => (
                        <div key={item.id} className={styles.listItem}>
                            <span className={styles.colNo}>Q{item.qNo}</span>
                            <div className={styles.colStatus}>
                                {item.isCorrect ? (
                                    <span className={`${styles.colStatus} ${styles.statusCorrect}`}>正解</span>
                                ) : item.answered ? (
                                    <span className={`${styles.colStatus} ${styles.statusIncorrect}`}>不正解</span>
                                ) : (
                                    <span className={`${styles.colStatus} ${styles.statusUnanswered}`}>未回答</span>
                                )}
                            </div>
                            <span className={styles.colTitle}>{item.text.substring(0, 40)}...</span>
                            <div className={styles.actionArea}>
                                <Link href={`/exam/${year}/${type}/${item.qNo}?mode=practice`} className={styles.reviewLink}>
                                    見直す
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <footer className={styles.footer}>
                <Link href="/exam" className={styles.backBtn}>一覧に戻る</Link>
                <button
                    onClick={() => handleNewSession('practice')}
                    className={styles.retryBtn}
                    disabled={isStarting}
                >
                    {isStarting ? '準備中...' : '新規セッションで再テスト'}
                </button>
            </footer>
        </div>
    );
}
