'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { guestManager } from '@/lib/guest-manager';
import { getLearningRecords, LearningRecord, Question, getExamProgress, createLearningSession, getLearningSessions, LearningSessionInfo } from '@/lib/api';
import { useAdContext, RewardedAdModal } from '@/components/features/ads';
import styles from './ExamEntranceClient.module.css';

interface ExamEntranceClientProps {
    year: string;
    type: string;
    examId: string;
    examLabel: string;
    questions: Question[];
}

function buildAttemptNumberMap(sessions: LearningSessionInfo[]): Record<string, number> {
    return sessions
        .slice()
        .sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime())
        .reduce<Record<string, number>>((accumulator, session, index) => {
            accumulator[session.id] = index + 1;
            return accumulator;
        }, {});
}

function formatAttemptDate(dateString: string): string {
    return new Date(dateString).toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getOrderedQuestionNumbers(questions: Question[]): number[] {
    return questions
        .map(question => question.qNo)
        .filter((qNo): qNo is number => Number.isInteger(qNo) && qNo > 0)
        .sort((left, right) => left - right);
}

function getFirstQuestionNumber(questions: Question[]): number {
    return getOrderedQuestionNumbers(questions)[0] ?? 1;
}

function getNextQuestionNumber(questions: Question[], currentQuestionNo: number): number {
    const questionNumbers = getOrderedQuestionNumbers(questions);
    const currentIndex = questionNumbers.indexOf(currentQuestionNo);
    if (currentIndex >= 0 && currentIndex < questionNumbers.length - 1) {
        return questionNumbers[currentIndex + 1];
    }

    return questionNumbers[0] ?? 1;
}

export default function ExamEntranceClient({ year, type, examId, examLabel, questions }: ExamEntranceClientProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [nextQNo, setNextQNo] = useState<number>(() => getFirstQuestionNumber(questions));
    const [progress, setProgress] = useState<{ completed: number, total: number }>({ completed: 0, total: questions.length });
    const [isLoaded, setIsLoaded] = useState(false);

    const { isRewardedAdEnabled, isAuthenticated } = useAdContext();
    const [showRewardedAd, setShowRewardedAd] = useState(false);
    const [pendingStart, setPendingStart] = useState<{ startQNo: number; mode: 'practice' | 'mock' } | null>(null);

    // State for learning status & bookmarks
    const [statusMap, setStatusMap] = useState<Record<string, 'correct' | 'incorrect' | 'review'>>({});
    const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
    const [recentSessions, setRecentSessions] = useState<LearningSessionInfo[]>([]);
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProgress() {
            const userId = session?.user?.id || guestManager.getGuestId();
            if (!userId) {
                setIsLoaded(true);
                return;
            };

            try {
                let records: LearningRecord[] = [];
                let examProgressData: Awaited<ReturnType<typeof getExamProgress>> = null;
                let sessionHistory: LearningSessionInfo[] = [];

                if (session?.user?.id) {
                    // Logged-in user: fetch from API
                    [records, examProgressData, sessionHistory] = await Promise.all([
                        getLearningRecords(userId, examId),
                        getExamProgress(userId, examId),
                        getLearningSessions(examId)
                    ]);
                    setRecentSessions(sessionHistory);
                } else {
                    // Guest mode: fetch from localStorage
                    const allRecords = guestManager.getHistory();
                    records = allRecords.filter(r => r.examId === examId);
                    setRecentSessions([]);
                }

                // 1. Process Bookmarks (logged-in only)
                if (examProgressData?.bookmarks) {
                    setBookmarks(new Set(examProgressData.bookmarks));
                }

                // 2. Build Status Map (Merge History & Progress)
                // Priority: Latest Record Status.
                const newStatusMap: Record<string, 'correct' | 'incorrect' | 'review'> = {};

                // A. Base processing from History using Latest Record per Question
                const recordsByQ: Record<string, LearningRecord[]> = {};
                records.forEach(r => {
                    if (!recordsByQ[r.questionId]) recordsByQ[r.questionId] = [];
                    recordsByQ[r.questionId].push(r);
                });

                Object.keys(recordsByQ).forEach(qId => {
                    // Sort by answeredAt desc (Latest first)
                    const sorted = recordsByQ[qId]
                        .filter(r => r && r.answeredAt)
                        .sort((a, b) =>
                            new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime()
                        );
                    const latest = sorted[0];

                    if (latest) {
                        // Priority: Review flag > Correct/Incorrect status
                        if (latest.isFlagged) {
                            // Flagged for review (regardless of correct/incorrect)
                            newStatusMap[qId] = 'review';
                        } else if (latest.isCorrect) {
                            newStatusMap[qId] = 'correct';
                        } else {
                            newStatusMap[qId] = 'incorrect';
                        }
                    }
                });

                if (examProgressData?.statusMap) {
                    Object.entries(examProgressData.statusMap).forEach(([qId, value]) => {
                        if (newStatusMap[qId]) return;
                        newStatusMap[qId] = value.isCorrect ? 'correct' : 'incorrect';
                    });
                }

                setStatusMap(newStatusMap);

                // Determine Next Question (First Unanswered)
                const answeredQIds = new Set([...Object.keys(newStatusMap)]);

                let firstUnanswered = getFirstQuestionNumber(questions);
                for (const q of questions) {
                    if (!answeredQIds.has(q.id)) {
                        firstUnanswered = q.qNo;
                        break;
                    }
                    firstUnanswered = getNextQuestionNumber(questions, q.qNo);
                }
                if (answeredQIds.size >= questions.length) firstUnanswered = getFirstQuestionNumber(questions);

                setNextQNo(firstUnanswered);
                setProgress({ completed: answeredQIds.size, total: questions.length });

            } catch (e) {
                console.error("Failed to fetch progress", e);
            } finally {
                setIsLoaded(true);
            }
        }

        fetchProgress();
    }, [session, examId, questions]);

    useEffect(() => {
        if (recentSessions.length === 0) {
            setExpandedSessionId(null);
            return;
        }

        setExpandedSessionId((current) => {
            if (current && recentSessions.some((item) => item.id === current)) {
                return current;
            }

            return recentSessions.find((item) => item.status === 'in-progress')?.id ?? recentSessions[0].id;
        });
    }, [recentSessions]);

    // ... (btnText, linkHref, mockSettings same)
    const btnText = (progress.completed > 0 && progress.completed < progress.total)
        ? `続きから開始 (Q${nextQNo})`
        : "練習モードで開始";

    const linkHref = `/exam/${year}/${type}/${nextQNo}?mode=practice`;

    const mockSettings = (() => {
        if (type === 'AM2') return { time: 40, count: questions.length };
        if (type.includes('PM')) return { time: 150, count: questions.length };
        return { time: 150, count: 80 };
    })();



    const formatAttemptDuration = (attempt: LearningSessionInfo) => {
        const end = attempt.completedAt ? new Date(attempt.completedAt).getTime() : Date.now();
        const start = new Date(attempt.startedAt).getTime();
        const minutes = Math.max(1, Math.round((end - start) / 60000));
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const remainMinutes = minutes % 60;
            return `${hours}時間${remainMinutes}分`;
        }
        return `${minutes}分`;
    };

    // 実際の試験開始処理（広告表示後に呼ばれる）
    const executeStartSession = useCallback(async (startQNo: number, mode: 'practice' | 'mock') => {
        const userId = session?.user?.id || guestManager.getGuestId();
        if (!userId) {
            router.push('/login');
            return;
        }

        let sessionId: string | undefined;

        if (session?.user?.id) {
            const totalQuestions = questions.length;
            const newSession = await createLearningSession(userId, examId, mode, totalQuestions);
            sessionId = newSession?.id;
        }

        const targetUrl = `/exam/${year}/${type}/${startQNo}?mode=${mode}${sessionId ? `&sessionId=${sessionId}` : ''}`;
        router.push(targetUrl);
    }, [session, examId, questions, year, type, router]);

    // 広告表示完了時のコールバック
    const handleAdComplete = useCallback(() => {
        setShowRewardedAd(false);
        if (pendingStart) {
            executeStartSession(pendingStart.startQNo, pendingStart.mode);
            setPendingStart(null);
        }
    }, [pendingStart, executeStartSession]);

    // 広告スキップ時のコールバック
    const handleAdSkip = useCallback(() => {
        setShowRewardedAd(false);
        if (pendingStart) {
            executeStartSession(pendingStart.startQNo, pendingStart.mode);
            setPendingStart(null);
        }
    }, [pendingStart, executeStartSession]);

    // 試験開始ボタン押下時: リワード広告が有効なら広告を表示、そうでなければ直接開始
    const startSession = (startQNo: number, mode: 'practice' | 'mock') => {
        if (isRewardedAdEnabled) {
            setPendingStart({ startQNo, mode });
            setShowRewardedAd(true);
        } else {
            executeStartSession(startQNo, mode);
        }
    };

    const attemptNumberMap = buildAttemptNumberMap(recentSessions);

    return (
        <>
        <RewardedAdModal
            isOpen={showRewardedAd}
            onComplete={handleAdComplete}
            onSkip={handleAdSkip}
            canSkip={isAuthenticated}
        />
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
                    <button
                        type="button"
                        onClick={() => startSession(nextQNo, 'practice')}
                        className={`${styles.btn} ${styles.btnPractice}`}
                        disabled={!isLoaded}
                    >
                        {isLoaded ? btnText : "読み込み中..."}
                        <span className={styles.btnSub}>即座に解説を表示</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => startSession(getFirstQuestionNumber(questions), 'mock')}
                        className={`${styles.btn} ${styles.btnMock}`}
                    >
                        模擬試験モードで開始
                        <span className={styles.btnSub}>{mockSettings.time}分 / {mockSettings.count}問</span>
                    </button>
                </div>
            </header>

            {recentSessions.length > 0 && (
                <section className={styles.attemptsSection}>
                    <div className={styles.attemptsHeader}>
                        <div>
                            <h2>実施履歴</h2>
                            <p>複数回の履歴を回ごとに開いて、進捗と分析を確認できます。</p>
                        </div>
                        <span className={styles.attemptCount}>{recentSessions.length}件</span>
                    </div>

                    <div className={styles.attemptsList}>
                        {recentSessions.map((attempt) => {
                            const totalQuestions = attempt.totalQuestions || questions.length;
                            const attemptNumber = attemptNumberMap[attempt.id] ?? 1;
                            const progressPercent = totalQuestions > 0
                                ? Math.round((attempt.answeredCount / totalQuestions) * 100)
                                : 0;
                            const scorePercent = totalQuestions > 0
                                ? Math.round((attempt.correctCount / totalQuestions) * 100)
                                : 0;
                            const accuracyPercent = attempt.answeredCount > 0
                                ? Math.round((attempt.correctCount / attempt.answeredCount) * 100)
                                : 0;
                            const safeQuestionNo = attempt.lastQuestionNo
                                ? getNextQuestionNumber(questions, attempt.lastQuestionNo)
                                : getFirstQuestionNumber(questions);
                            const continueHref = `/exam/${year}/${type}/${safeQuestionNo}?mode=${attempt.mode}&sessionId=${attempt.id}`;
                            const resultHref = `/exam/${year}/${type}/result?sessionId=${attempt.id}&mode=${attempt.mode}`;
                            const isExpanded = expandedSessionId === attempt.id;
                            const accordionPanelId = `attempt-panel-${attempt.id}`;
                            const attemptLabel = `第${attemptNumber}回`;

                            return (
                                <article key={attempt.id} className={styles.attemptCard}>
                                    <button
                                        type="button"
                                        className={styles.attemptAccordionButton}
                                        aria-expanded={isExpanded}
                                        aria-controls={accordionPanelId}
                                        onClick={() => {
                                            setExpandedSessionId((current) => current === attempt.id ? null : attempt.id);
                                        }}
                                    >
                                        <div className={styles.attemptSummary}>
                                            <div className={styles.attemptTitleRow}>
                                                <div className={styles.attemptMeta}>
                                                    <span className={styles.attemptSequence}>{attemptLabel}</span>
                                                    <span className={styles.attemptBadge}>
                                                        {attempt.mode === 'practice' ? '練習モード' : '模擬試験'}
                                                    </span>
                                                    <span className={`${styles.attemptStatus} ${attempt.status === 'completed' ? styles.attemptStatusDone : styles.attemptStatusActive}`}>
                                                        {attempt.status === 'completed' ? '完了' : '進行中'}
                                                    </span>
                                                </div>
                                                <time className={styles.attemptDate} dateTime={attempt.startedAt}>
                                                    {formatAttemptDate(attempt.startedAt)}
                                                </time>
                                            </div>

                                            <div className={styles.attemptSummaryStats}>
                                                <span className={styles.attemptSummaryStat}>進捗 <strong>{attempt.answeredCount}/{totalQuestions}問</strong></span>
                                                <span className={styles.attemptSummaryStat}>正答率 <strong>{accuracyPercent}%</strong></span>
                                                <span className={styles.attemptSummaryStat}>所要時間 <strong>{formatAttemptDuration(attempt)}</strong></span>
                                            </div>
                                        </div>

                                        <span className={`${styles.attemptChevron} ${isExpanded ? styles.attemptChevronOpen : ''}`} aria-hidden="true">
                                            ▾
                                        </span>
                                    </button>

                                    {isExpanded && (
                                        <div id={accordionPanelId} className={styles.attemptDetails}>
                                            <div className={styles.attemptStats}>
                                                <div className={styles.attemptStat}>
                                                    <span className={styles.attemptStatLabel}>進捗率</span>
                                                    <strong>{progressPercent}%</strong>
                                                </div>
                                                <div className={styles.attemptStat}>
                                                    <span className={styles.attemptStatLabel}>総合スコア</span>
                                                    <strong>{scorePercent}%</strong>
                                                </div>
                                                <div className={styles.attemptStat}>
                                                    <span className={styles.attemptStatLabel}>正答率</span>
                                                    <strong>{accuracyPercent}%</strong>
                                                </div>
                                                <div className={styles.attemptStat}>
                                                    <span className={styles.attemptStatLabel}>最終到達</span>
                                                    <strong>Q{attempt.lastQuestionNo || 1}</strong>
                                                </div>
                                            </div>

                                            <div className={styles.progressBar}>
                                                <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}></div>
                                            </div>

                                            <div className={styles.attemptMetaGrid}>
                                                <div className={styles.attemptMetaItem}>
                                                    <span className={styles.attemptStatLabel}>開始日時</span>
                                                    <strong>{formatAttemptDate(attempt.startedAt)}</strong>
                                                </div>
                                                <div className={styles.attemptMetaItem}>
                                                    <span className={styles.attemptStatLabel}>完了日時</span>
                                                    <strong>{attempt.completedAt ? formatAttemptDate(attempt.completedAt) : '進行中'}</strong>
                                                </div>
                                            </div>

                                            <div className={styles.attemptActions}>
                                                <Link href={resultHref} className={styles.attemptLink}>
                                                    分析を見る
                                                </Link>
                                                <Link href={attempt.status === 'completed' ? resultHref : continueHref} className={styles.attemptSecondaryLink}>
                                                    {attempt.status === 'completed' ? '見直す' : '続きから'}
                                                </Link>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
        </>
    );
}
