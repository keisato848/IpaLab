'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { guestManager } from '@/lib/guest-manager';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { getLearningRecords, LearningRecord, Question } from '@/lib/api';
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

    // State for learning status
    const [statusMap, setStatusMap] = useState<Record<string, 'correct' | 'incorrect'>>({});

    useEffect(() => {
        async function fetchProgress() {
            const userId = session?.user?.id || guestManager.getGuestId();
            if (!userId) {
                setIsLoaded(true);
                return;
            };

            try {
                const records = await getLearningRecords(userId, examId);
                const answeredQIds = new Set(records.map(r => r.questionId));

                // Build status map
                const newStatusMap: Record<string, 'correct' | 'incorrect'> = {};

                // Group records by questionId
                const recordsByQ: Record<string, LearningRecord[]> = {};
                records.forEach(r => {
                    if (!recordsByQ[r.questionId]) recordsByQ[r.questionId] = [];
                    recordsByQ[r.questionId].push(r);
                });

                Object.keys(recordsByQ).forEach(qId => {
                    const qRecords = recordsByQ[qId];
                    // If ANY correct, mark as correct (Optimistic)
                    // Or prioritize latest? Let's use ANY correct for "Done" feel.
                    const hasCorrect = qRecords.some(r => r.isCorrect);
                    newStatusMap[qId] = hasCorrect ? 'correct' : 'incorrect';
                });
                setStatusMap(newStatusMap);

                // ... existing nextQNo logic ...
                let firstUnanswered: number = 1;
                for (const q of questions) {
                    if (!answeredQIds.has(q.id)) {
                        firstUnanswered = q.qNo;
                        break;
                    }
                    firstUnanswered = q.qNo + 1;
                }
                if (firstUnanswered > questions.length) firstUnanswered = 1;
                if (answeredQIds.size === questions.length) firstUnanswered = 1;

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

    const btnText = (progress.completed > 0 && progress.completed < progress.total)
        ? `続きから開始 (Q${nextQNo})`
        : "練習モードで開始";

    const linkHref = `/exam/${year}/${type}/${nextQNo}?mode=practice`;

    const mockSettings = (() => {
        if (type === 'AM2') return { time: 40, count: questions.length };
        if (type.includes('PM')) return { time: 150, count: questions.length };
        return { time: 150, count: 80 };
    })();

    // Filter questions based on query param
    const displayQuestions = questions.filter(q => {
        if (!categoryFilter || categoryFilter === 'ALL') return true;

        // Check both category and subCategory
        // q.subCategory might be standardized Japanese e.g. "テクノロジ系"
        // categoryFilter is English e.g. "Technology"
        // Need mapping? Or lenient check?
        // fix-subcategories.ts mapped 'Technology' -> 'テクノロジ系'.
        // So we should compare against mapped values or raw.

        // Simple mapping for filter:
        const map: Record<string, string> = {
            'Technology': 'テクノロジ系',
            'Management': 'マネジメント系',
            'Strategy': 'ストラテジ系'
        };
        const targetJp = map[categoryFilter];

        return (q.subCategory === targetJp) || (q.category === categoryFilter) || (q.subCategory === categoryFilter);
    });

    const displayCount = displayQuestions.length > 0 ? displayQuestions.length : mockSettings.count;

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
                            // Update URL query param to keep state on refresh
                            // Since this is a client component, we can use router.push or window.history
                            // But cleaner to just reload or push state. Next.js router is best.
                            // We need 'useRouter'
                            const newUrl = new URL(window.location.href);
                            if (val === 'ALL') newUrl.searchParams.delete('category');
                            else newUrl.searchParams.set('category', val);
                            window.history.pushState(null, '', newUrl.toString());
                            // Trigger re-render by local state or router?
                            // next/navigation searchParams is reactive?
                            // Actually better to use useRouter().push()
                        }}
                    // Actually let's use a simpler approach: Local State driven + Sync to URL?
                    // Or just fully local state?
                    // Requirement: "Move filter" implies keeping it persistent?
                    // User said: "Select from dynamic list if possible"
                    >
                        <option value="ALL">指定なし (すべて表示)</option>
                        {/* TODO: Generate dynamic options? Strict requirement "Dynamic or Constant". 
                             Constants are easier for now: Technology, Management, Strategy.
                             Or extract unique from questions? */}
                        <option value="Technology">テクノロジ系</option>
                        <option value="Management">マネジメント系</option>
                        <option value="Strategy">ストラテジ系</option>
                        {/* Dynamic unique subcategories from questions if available? */}
                        {/* Let's append unique ones not in constant? */}
                    </select>
                </div>

                <div className={styles.actions}>
                    <Link href={linkHref} className={`${styles.btn} ${styles.btnPractice}`}>
                        {isLoaded ? btnText : "読み込み中..."}
                        <span className={styles.btnSub}>即座に解説を表示</span>
                    </Link>
                    <Link href={`/exam/${year}/${type}/1?mode=mock`} className={`${styles.btn} ${styles.btnMock}`}>
                        模擬試験モードで開始
                        <span className={styles.btnSub}>{mockSettings.time}分 / {displayCount}問</span>
                    </Link>
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
                            const status = statusMap[q.id]; // 'correct' | 'incorrect' | undefined
                            const statusClass = status === 'correct' ? styles.correct
                                : status === 'incorrect' ? styles.incorrect
                                    : '';

                            return (
                                <Link
                                    href={`/exam/${year}/${type}/${q.qNo}?mode=practice`}
                                    key={q.id}
                                    className={`${styles.qItem} ${statusClass}`}
                                >
                                    <span className={styles.qNo}>
                                        Q{q.qNo}
                                        {status === 'correct' && <FaCheckCircle className={styles.iconCorrect} />}
                                        {status === 'incorrect' && <FaTimesCircle className={styles.iconIncorrect} />}
                                    </span>

                                    <p className={styles.qSummary}>{(q.text || "").substring(0, 40)}...</p>

                                    {/* Accessibility and Subcategory Badge */}
                                    <div className={styles.badgeContainer}>
                                        {/* Subcategory Badge */}
                                        {(q.subCategory || q.category) && (
                                            <span className={styles.subcategoryBadge}>
                                                {q.subCategory || q.category}
                                            </span>
                                        )}

                                        {/* Status Badge */}
                                        {status && (
                                            <span className={styles.statusBadge}>
                                                {status === 'correct' ? '済: 正解' : '済: 不正解'}
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
