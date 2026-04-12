'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { guestManager } from '@/lib/guest-manager';
import { FaCheckCircle, FaTimesCircle, FaBookmark } from 'react-icons/fa';
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

export default function ExamEntranceClient({ year, type, examId, examLabel, questions }: ExamEntranceClientProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [nextQNo, setNextQNo] = useState<number>(1);
    const [progress, setProgress] = useState<{ completed: number, total: number }>({ completed: 0, total: questions.length });
    const [isLoaded, setIsLoaded] = useState(false);

    const { isRewardedAdEnabled, isAuthenticated } = useAdContext();
    const [showRewardedAd, setShowRewardedAd] = useState(false);
    const [pendingStart, setPendingStart] = useState<{ startQNo: number; mode: 'practice' | 'mock' } | null>(null);

    const searchParams = useSearchParams();
    const categoryFilter = searchParams.get('category');

    // Handle filter change
    const handleFilterChange = (val: string) => {
        const newUrl = new URL(window.location.href);
        if (val === 'ALL') newUrl.searchParams.delete('category');
        else newUrl.searchParams.set('category', val);
        router.push(newUrl.toString());
    };

    // State for learning status & bookmarks
    const [statusMap, setStatusMap] = useState<Record<string, 'correct' | 'incorrect' | 'review'>>({});
    const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
    const [recentSessions, setRecentSessions] = useState<LearningSessionInfo[]>([]);

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
                        getLearningSessions(examId, undefined, 8)
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

                let firstUnanswered: number = 1;
                for (const q of questions) {
                    if (!answeredQIds.has(q.id)) {
                        firstUnanswered = q.qNo;
                        break;
                    }
                    if (q.qNo >= firstUnanswered) firstUnanswered = q.qNo + 1;
                }
                if (firstUnanswered > questions.length) firstUnanswered = 1;
                // If all answered, loop back to 1 (or stay at end?)
                if (answeredQIds.size >= questions.length && firstUnanswered > questions.length) firstUnanswered = 1;

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

    const displayQuestions = questions.filter(q => {
        if (q.qNo >= 99) return false;
        if (!categoryFilter || categoryFilter === 'ALL') return true;

        const map: Record<string, string> = {
            'Technology': 'テクノロジ系',
            'Management': 'マネジメント系',
            'Strategy': 'ストラテジ系'
        };
        const targetJp = map[categoryFilter];
        return (q.subCategory === targetJp) || (q.category === categoryFilter) || (q.subCategory === categoryFilter);
    });

    const displayCount = displayQuestions.length > 0 ? displayQuestions.length : mockSettings.count;

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

                {/* Subcategory Filter UI */}
                <div className={styles.filterContainer}>
                    <label className={styles.filterLabel}>分野で絞り込み:</label>
                    <select
                        className={styles.filterSelect}
                        value={categoryFilter || 'ALL'}
                        onChange={(e) => {
                            const val = e.target.value;
                            const newUrl = new URL(window.location.href);
                            if (val === 'ALL') newUrl.searchParams.delete('category');
                            else newUrl.searchParams.set('category', val);
                            const routerMethod = router.push; // Using router push
                            routerMethod(newUrl.toString());
                        }}
                    >
                        <option value="ALL">指定なし (すべて表示)</option>
                        <option value="Technology">テクノロジ系</option>
                        <option value="Management">マネジメント系</option>
                        <option value="Strategy">ストラテジ系</option>
                    </select>
                </div>

                <div className={styles.actions}>
                    <button
                        onClick={() => startSession(nextQNo, 'practice')}
                        className={`${styles.btn} ${styles.btnPractice}`}
                        disabled={!isLoaded}
                    >
                        {isLoaded ? btnText : "読み込み中..."}
                        <span className={styles.btnSub}>即座に解説を表示</span>
                    </button>
                    <button
                        onClick={() => startSession(1, 'mock')}
                        className={`${styles.btn} ${styles.btnMock}`}
                    >
                        模擬試験モードで開始
                        <span className={styles.btnSub}>{mockSettings.time}分 / {displayCount}問</span>
                    </button>
                </div>
            </header>

            {recentSessions.length > 0 && (
                <section className={styles.attemptsSection}>
                    <div className={styles.attemptsHeader}>
                        <div>
                            <h2>最近の実施履歴</h2>
                            <p>各セッションごとに進捗とスコアを確認できます。</p>
                        </div>
                        <span className={styles.attemptCount}>{recentSessions.length}件</span>
                    </div>

                    <div className={styles.attemptsList}>
                        {recentSessions.map((attempt) => {
                            const progressPercent = attempt.totalQuestions && attempt.totalQuestions > 0
                                ? Math.round((attempt.answeredCount / attempt.totalQuestions) * 100)
                                : 0;
                            const scorePercent = attempt.totalQuestions && attempt.totalQuestions > 0
                                ? Math.round((attempt.correctCount / attempt.totalQuestions) * 100)
                                : 0;
                            const nextQuestionNo = attempt.lastQuestionNo ? attempt.lastQuestionNo + 1 : 1;
                            const safeQuestionNo = nextQuestionNo > (attempt.totalQuestions || 1) ? 1 : nextQuestionNo;
                            const continueHref = `/exam/${year}/${type}/${safeQuestionNo}?mode=${attempt.mode}&sessionId=${attempt.id}`;
                            const resultHref = `/exam/${year}/${type}/result?sessionId=${attempt.id}&mode=${attempt.mode}`;

                            return (
                                <article key={attempt.id} className={styles.attemptCard}>
                                    <div className={styles.attemptTitleRow}>
                                        <div className={styles.attemptMeta}>
                                            <span className={styles.attemptBadge}>
                                                {attempt.mode === 'practice' ? '練習モード' : '模擬試験'}
                                            </span>
                                            <span className={`${styles.attemptStatus} ${attempt.status === 'completed' ? styles.attemptStatusDone : styles.attemptStatusActive}`}>
                                                {attempt.status === 'completed' ? '完了' : '進行中'}
                                            </span>
                                        </div>
                                        <time className={styles.attemptDate} dateTime={attempt.startedAt}>
                                            {new Date(attempt.startedAt).toLocaleString('ja-JP', {
                                                year: 'numeric',
                                                month: 'numeric',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </time>
                                    </div>

                                    <div className={styles.attemptStats}>
                                        <div className={styles.attemptStat}>
                                            <span className={styles.attemptStatLabel}>スコア</span>
                                            <strong>{scorePercent}%</strong>
                                        </div>
                                        <div className={styles.attemptStat}>
                                            <span className={styles.attemptStatLabel}>進捗</span>
                                            <strong>{attempt.answeredCount}/{attempt.totalQuestions || questions.length}問</strong>
                                        </div>
                                        <div className={styles.attemptStat}>
                                            <span className={styles.attemptStatLabel}>所要時間</span>
                                            <strong>{formatAttemptDuration(attempt)}</strong>
                                        </div>
                                    </div>

                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}></div>
                                    </div>

                                    <div className={styles.attemptActions}>
                                        <Link href={resultHref} className={styles.attemptLink}>
                                            分析を見る
                                        </Link>
                                        <Link href={attempt.status === 'completed' ? resultHref : continueHref} className={styles.attemptSecondaryLink}>
                                            {attempt.status === 'completed' ? '見直す' : '続きから'}
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            <section className={styles.questionList}>
                <h2>問題一覧 ({displayQuestions.length}問)</h2>
                {displayQuestions.length === 0 ? (
                    <p className={styles.noData}>
                        問題データが見つかりません。<br />
                        バックエンドAPIが起動しているか、examId ({examId}) が正しいか確認してください。
                        <br />(フィルタ条件に一致する問題がない可能性があります)
                    </p>
                ) : (
                    <div className={styles.grid}>
                        {displayQuestions.map(q => {
                            const status = statusMap[q.id];
                            const isBookmarked = bookmarks.has(q.id);

                            // Class logic: Status + Bookmark
                            let statusClass = '';
                            if (status === 'correct') statusClass = styles.correct;
                            else if (status === 'incorrect') statusClass = styles.incorrect;
                            else if (status === 'review') statusClass = styles.review;

                            // Helper for item
                            return (
                                <Link
                                    href={`/exam/${year}/${type}/${q.qNo}?mode=practice`}
                                    key={q.id}
                                    className={`${styles.qItem} ${statusClass} ${isBookmarked ? styles.bookmarkedItem : ''}`}
                                    style={isBookmarked ? { border: '2px solid #f59e0b' } : {}}
                                >
                                    <span className={styles.qNo} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Q{q.qNo}
                                        {status === 'correct' && <FaCheckCircle className={styles.iconCorrect} />}
                                        {status === 'incorrect' && <FaTimesCircle className={styles.iconIncorrect} />}
                                        {status === 'review' && <span title="見直し">🚩</span>}
                                        {isBookmarked && <FaBookmark color="#f59e0b" />}
                                    </span>

                                    <p className={styles.qSummary}>{(q.text || "").substring(0, 40)}...</p>

                                    <div className={styles.badgeContainer}>
                                        {(q.subCategory || q.category) && (
                                            <span className={styles.subcategoryBadge}>
                                                {q.subCategory || q.category}
                                            </span>
                                        )}
                                        {status && (
                                            <span className={`${styles.statusBadge} ${status === 'review' ? styles.statusReview : ''}`}>
                                                {status === 'correct' ? '正解' : (status === 'review' ? '見直し' : '不正解')}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )
                }
            </section>
        </div>
        </>
    );
}
