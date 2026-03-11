'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getLearningSessions, LearningSessionInfo, LearningRecord, getLearningRecords, updateSessionProgress } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import { getExamLabel } from '@/lib/exam-utils';
import styles from './HistoryList.module.css';

export default function HistoryList() {
    const { data: session, status } = useSession();
    const [sessions, setSessions] = useState<LearningSessionInfo[]>([]);
    const [guestRecords, setGuestRecords] = useState<LearningRecord[]>([]);
    const [fallbackRecords, setFallbackRecords] = useState<LearningRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const isGuest = status !== 'authenticated';

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                if (status === 'authenticated' && session?.user?.id) {
                    // セッションを取得
                    const fetchedSessions = await getLearningSessions();
                    setSessions(fetchedSessions);

                    // セッションがない場合、個別レコードをフォールバックとして取得
                    if (fetchedSessions.length === 0) {
                        const records = await getLearningRecords(session.user.id);
                        const validRecords = records.filter(r => r && r.answeredAt);
                        validRecords.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
                        setFallbackRecords(validRecords);
                    }
                } else {
                    // Guest mode: show legacy records-based view
                    const records = guestManager.getHistory();
                    // Filter out records with invalid or missing answeredAt
                    const validRecords = records.filter(r => r && r.answeredAt);
                    validRecords.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
                    setGuestRecords(validRecords);
                }
            } catch (err) {
                console.error("Failed to load history", err);
            } finally {
                setLoading(false);
            }
        }

        if (status !== 'loading') {
            loadData();
        }
    }, [status, session]);

    if (loading) {
        return <div className={styles.loading}>読み込み中...</div>;
    }

    // Guest mode: show legacy record-based view
    if (isGuest) {
        if (guestRecords.length === 0) {
            return (
                <div className={styles.emptyState}>
                    <p>学習履歴がありません。</p>
                    <Link href="/exam" className={styles.startBtn}>学習を開始する</Link>
                </div>
            );
        }
        return (
            <div className={styles.container}>
                {guestRecords.map((r, i) => (
                    <div key={i} className={styles.historyCard}>
                        <div className={styles.cardMain}>
                            <div className={styles.examTitle}>
                                {getExamLabel(r.examId)}
                            </div>
                            <div className={styles.questionInfo}>
                                <span>問題 {r.questionId.split('-').pop()}</span>
                                <span className={r.isCorrect ? styles.tagCorrect : styles.tagIncorrect}>
                                    {r.isCorrect ? '正解' : '不正解'}
                                </span>
                            </div>
                        </div>
                        <div className={styles.cardMeta}>
                            <div className={styles.date}>
                                {r.answeredAt ? new Date(r.answeredAt).toLocaleString('ja-JP') : '-'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Logged-in users: session-based view
    // セッションがない場合、個別レコードがあればレコードベースの表示にフォールバック
    if (sessions.length === 0) {
        if (fallbackRecords.length > 0) {
            return (
                <div className={styles.container}>
                    {fallbackRecords.map((r, i) => (
                        <div key={i} className={styles.historyCard}>
                            <div className={styles.cardMain}>
                                <div className={styles.examTitle}>
                                    {getExamLabel(r.examId)}
                                </div>
                                <div className={styles.questionInfo}>
                                    <span>問題 {r.questionId.split('-').pop()}</span>
                                    <span className={r.isCorrect ? styles.tagCorrect : styles.tagIncorrect}>
                                        {r.isCorrect ? '正解' : '不正解'}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.cardMeta}>
                                <div className={styles.date}>
                                    {r.answeredAt ? new Date(r.answeredAt).toLocaleString('ja-JP') : '-'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
        return (
            <div className={styles.emptyState}>
                <p>学習履歴がありません。</p>
                <Link href="/exam" className={styles.startBtn}>学習を開始する</Link>
            </div>
        );
    }

    // Group sessions: in-progress first, then completed
    const inProgressSessions = sessions.filter(s => s.status === 'in-progress');
    const completedSessions = sessions.filter(s => s.status === 'completed');

    // Handler to refresh sessions after finishing one
    const handleSessionFinish = (sessionId: string) => {
        setSessions(prev => prev.map(s => 
            s.id === sessionId ? { ...s, status: 'completed' as const } : s
        ));
    };

    return (
        <div className={styles.container}>
            {/* In-progress sessions */}
            {inProgressSessions.length > 0 && (
                <div className={styles.sectionHeader}>
                    <span className={styles.sectionIcon}>▶</span>
                    進行中のセッション ({inProgressSessions.length})
                </div>
            )}
            {inProgressSessions.map((s) => (
                <SessionCard key={s.id} session={s} onFinish={handleSessionFinish} />
            ))}

            {/* Completed sessions */}
            {completedSessions.length > 0 && (
                <div className={styles.sectionHeader}>
                    <span className={styles.sectionIcon}>✓</span>
                    完了したセッション ({completedSessions.length})
                </div>
            )}
            {completedSessions.map((s) => (
                <SessionCard key={s.id} session={s} />
            ))}
        </div>
    );
}

function SessionCard({ session: s, onFinish }: { session: LearningSessionInfo; onFinish?: (id: string) => void }) {
    const router = useRouter();
    const examLabel = getExamLabel(s.examId);
    const progressPercent = s.totalQuestions && s.totalQuestions > 0
        ? Math.round((s.answeredCount / s.totalQuestions) * 100)
        : 0;
    const correctRate = s.answeredCount > 0
        ? Math.round((s.correctCount / s.answeredCount) * 100)
        : 0;

    // Parse examId to extract year and type for URL construction
    // examId format: "FE-2024-Spring-AM2" → year="FE-2024-Spring", type="AM2"
    // Or: "SC-2023-Fall-PM" → year="SC-2023-Fall", type="PM"
    const parseExamId = (examId: string) => {
        const parts = examId.split('-');
        // Find where type starts (AM, AM1, AM2, PM, PM1, PM2)
        const typePatterns = ['AM1', 'AM2', 'AM', 'PM1', 'PM2', 'PM'];
        let typeIndex = parts.length;
        for (let i = parts.length - 1; i >= 0; i--) {
            if (typePatterns.includes(parts[i])) {
                typeIndex = i;
                break;
            }
        }
        const year = parts.slice(0, typeIndex).join('-');
        const type = parts.slice(typeIndex).join('-') || 'AM';
        return { year, type };
    };

    const { year, type } = parseExamId(s.examId);
    
    const continueQNo = s.lastQuestionNo ? s.lastQuestionNo + 1 : 1;
    const safeQNo = continueQNo > (s.totalQuestions || 1) ? 1 : continueQNo;
    
    const continueHref = `/exam/${year}/${type}/${safeQNo}?mode=${s.mode}&sessionId=${s.id}`;
    const resultHref = `/exam/${year}/${type}/result?sessionId=${s.id}`;
    const examEntranceHref = `/exam/${year}/${type}`;

    const handleFinishSession = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Mark session as completed
        await updateSessionProgress(s.id, { status: 'completed' });
        
        // Navigate to result page
        router.push(resultHref);
        
        // Notify parent to refresh
        onFinish?.(s.id);
    };

    return (
        <div className={`${styles.historyCard} ${s.status === 'in-progress' ? styles.inProgress : ''}`}>
            <div className={styles.cardMain}>
                <div className={styles.examTitle}>
                    {examLabel}
                </div>
                <div className={styles.sessionInfo}>
                    <span className={styles.modeTag}>
                        {s.mode === 'practice' ? '練習' : '模擬'}
                    </span>
                    <span className={styles.progressText}>
                        {s.answeredCount}/{s.totalQuestions || '?'} 問解答済み
                    </span>
                    {s.answeredCount > 0 && (
                        <span className={correctRate >= 60 ? styles.tagCorrect : styles.tagIncorrect}>
                            正答率 {correctRate}%
                        </span>
                    )}
                </div>
                {/* Progress bar */}
                <div className={styles.progressBar}>
                    <div 
                        className={styles.progressFill} 
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>
            <div className={styles.cardMeta}>
                <div className={styles.date}>
                    {new Date(s.startedAt).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
                
                {/* Action buttons */}
                <div className={styles.actionButtons}>
                    {s.status === 'in-progress' ? (
                        <>
                            <Link href={continueHref} className={styles.continueBtn}>
                                続きから →
                            </Link>
                            <button onClick={handleFinishSession} className={styles.finishBtn}>
                                採点して終了
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href={resultHref} className={styles.resultBtn}>
                                結果を見る
                            </Link>
                            <Link href={examEntranceHref} className={styles.listBtn}>
                                問題一覧
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

