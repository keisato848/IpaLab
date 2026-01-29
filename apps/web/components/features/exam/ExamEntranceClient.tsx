'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { guestManager } from '@/lib/guest-manager';
import { FaCheckCircle, FaTimesCircle, FaBookmark } from 'react-icons/fa';
import { getLearningRecords, LearningRecord, Question, getExamProgress, createLearningSession } from '@/lib/api';
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

                if (session?.user?.id) {
                    // Logged-in user: fetch from API
                    [records, examProgressData] = await Promise.all([
                        getLearningRecords(userId, examId),
                        getExamProgress(userId, examId)
                    ]);
                } else {
                    // Guest mode: fetch from localStorage
                    const allRecords = guestManager.getHistory();
                    records = allRecords.filter(r => r.examId === examId);
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
                    const sorted = recordsByQ[qId].sort((a, b) =>
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

    const startSession = async (startQNo: number, mode: 'practice' | 'mock') => {
        const userId = session?.user?.id || guestManager.getGuestId();
        if (!userId) {
            // Redirect to login if no user
            router.push('/login');
            return;
        }

        let sessionId: string | undefined;

        // Only create DB session for logged-in users
        if (session?.user?.id) {
            const totalQuestions = questions.length;
            const newSession = await createLearningSession(userId, examId, mode, totalQuestions);
            sessionId = newSession?.id;
        }

        const targetUrl = `/exam/${year}/${type}/${startQNo}?mode=${mode}${sessionId ? `&sessionId=${sessionId}` : ''}`;
        router.push(targetUrl);
    };

    return (
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
    );
}
