'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Exam, LearningRecord, getExams, getLearningRecords } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import styles from '@/app/(main)/exam/page.module.css';

interface ExamListClientProps {
    initialExams: Exam[];
    initialRecords?: LearningRecord[];
}

const FILTER_CACHE_KEY = 'ipalab_exam_filter';
const TIME_FILTER_CACHE_KEY = 'ipalab_exam_time_filter';

function getCachedValue(key: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    return localStorage.getItem(key) || fallback;
}

export default function ExamListClient({ initialExams, initialRecords = [] }: ExamListClientProps) {
    const [exams, setExams] = useState<Exam[]>(initialExams);
    const [isLoading, setIsLoading] = useState(initialExams.length === 0);
    const [filter, setFilter] = useState(() => getCachedValue(FILTER_CACHE_KEY, 'ALL'));
    const [timeFilter, setTimeFilter] = useState(() => getCachedValue(TIME_FILTER_CACHE_KEY, 'ALL'));
    const { data: session } = useSession();
    const [userLearningRecords, setUserLearningRecords] = useState<LearningRecord[]>(initialRecords);

    // 選択状態をlocalStorageに保存
    useEffect(() => {
        localStorage.setItem(FILTER_CACHE_KEY, filter);
    }, [filter]);

    useEffect(() => {
        localStorage.setItem(TIME_FILTER_CACHE_KEY, timeFilter);
    }, [timeFilter]);

    // Fetch exams on client if not provided by server (SSG build time)
    useEffect(() => {
        if (initialExams.length === 0) {
            getExams().then(data => {
                setExams(data);
                setIsLoading(false);
            }).catch(() => {
                setIsLoading(false);
            });
        }
    }, [initialExams.length]);

    // ログイン済みユーザーの学習記録をクライアントサイドで取得
    useEffect(() => {
        if (session?.user?.id) {
            getLearningRecords(session.user.id).then(records => {
                setUserLearningRecords(records);
            }).catch(() => {
                // エラー時は初期値（空配列）のまま
            });
        }
    }, [session?.user?.id]);

    // Merge stats with user's learning records
    const examsWithStats = useMemo(() => {
        // Get guest records if not authenticated
        const userRecords = session?.user?.id
            ? userLearningRecords
            : guestManager.getHistory();

        return exams.map(exam => {
            const examRecords = userRecords.filter(r => r && r.examId === exam.id);
            const uniqueAnswered = new Set(examRecords.filter(r => r && r.questionId).map(r => r.questionId)).size;
            const correctCount = examRecords.filter(r => r.isCorrect).length;
            const totalAttempts = examRecords.length;
            const correctRate = totalAttempts > 0 ? correctCount / totalAttempts : 0;

            return {
                ...exam,
                stats: {
                    total: exam.stats.total > 0 ? exam.stats.total : 0,
                    completed: uniqueAnswered,
                    correctRate: correctRate
                }
            };
        });
    }, [exams, userLearningRecords, session?.user?.id]);

    const filteredExams = useMemo(() => {
        return examsWithStats.filter(e => {
            const catMatch = filter === 'ALL' || e.category === filter;
            let timeMatch = true;

            if (timeFilter === 'AM') {
                timeMatch = e.id.includes('AM') || e.title.includes('午前');
            } else if (timeFilter === 'PM') {
                const isAM = e.id.includes('AM') || e.title.includes('午前');
                if (isAM) {
                    timeMatch = false;
                } else {
                    timeMatch = e.title.includes('午後') || e.id.endsWith('PM') || e.id.includes('-PM') || e.id.startsWith('PM-') || e.id.startsWith('SC-');
                }
            }
            return catMatch && timeMatch;
        });
    }, [examsWithStats, filter, timeFilter]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>演習・模擬試験</h1>
                <p className={styles.subtitle}>過去問題を選択して学習を開始しましょう。</p>
            </header>

            <div className={styles.filterContainer}>
                <div className={styles.filterSection}>
                    {/* Category Filters */}
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>区分:</span>
                        <select
                            className={styles.dropdown}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        >
                            <option value="ALL">すべて</option>
                            <option value="FE">基本情報 (FE)</option>
                            <option value="AP">応用情報 (AP)</option>
                            <option value="SC">安全確保支援士 (SC)</option>
                            <option value="PM">プロマネ (PM)</option>
                            <option value="IP">ITパスポート (IP)</option>
                            <option value="SA">システムアーキテクト (SA)</option>
                            <option value="ST">ITストラテジスト (ST)</option>
                        </select>
                    </div>

                    {/* Time Filters - Segment Buttons */}
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>時間帯:</span>
                        <div className={styles.segmentGroup}>
                            <button
                                type="button"
                                className={`${styles.segmentButton} ${timeFilter === 'ALL' ? styles.segmentActive : ''}`}
                                onClick={() => setTimeFilter('ALL')}
                            >
                                すべて
                            </button>
                            <button
                                type="button"
                                className={`${styles.segmentButton} ${timeFilter === 'AM' ? styles.segmentActive : ''}`}
                                onClick={() => setTimeFilter('AM')}
                            >
                                午前
                            </button>
                            <button
                                type="button"
                                className={`${styles.segmentButton} ${timeFilter === 'PM' ? styles.segmentActive : ''}`}
                                onClick={() => setTimeFilter('PM')}
                            >
                                午後
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.grid}>
                {isLoading ? (
                    <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        読み込み中...
                    </p>
                ) : filteredExams.length === 0 ? (
                    <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        該当する試験区分は見つかりませんでした。
                    </p>
                ) : (
                    filteredExams.map((exam) => {
                        let startType = 'AM1';
                        if (exam.id.includes('AM2')) startType = 'AM2';
                        else if (exam.id.includes('PM1')) startType = 'PM1';
                        else if (exam.id.includes('PM2')) startType = 'PM2';
                        else if (exam.id.includes('PM') && !exam.id.startsWith('PM-')) startType = 'PM';

                        const linkHref = `/exam/${exam.id}/${startType}`;
                        const progressPercent = exam.stats.total > 0
                            ? Math.round((exam.stats.completed / exam.stats.total) * 100)
                            : 0;

                        return (
                            <Link href={linkHref} key={exam.id} className={styles.cardLink}>
                                <article className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <span className={styles.tag}>{exam.category}</span>
                                        <span className={styles.date}>{exam.date}</span>
                                    </div>
                                    <h3 className={styles.title}>{exam.title}</h3>

                                    <div className={styles.stats}>
                                        <div className={styles.statItem}>
                                            <span className={styles.statLabel}>進捗率</span>
                                            <span className={styles.statValue}>{progressPercent}%</span>
                                        </div>
                                        <div className={styles.statItem}>
                                            <span className={styles.statLabel}>正答率</span>
                                            <span className={styles.statValue}>{Math.round(exam.stats.correctRate * 100)}%</span>
                                        </div>
                                    </div>

                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}></div>
                                    </div>
                                </article>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
}
