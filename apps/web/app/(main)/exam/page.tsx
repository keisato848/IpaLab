'use client';

import styles from './page.module.css';
import Link from 'next/link';

import { useEffect, useState } from 'react';
import { getExams, Exam, getLearningRecords } from '@/lib/api';
import { useSession } from 'next-auth/react';
import { guestManager } from '@/lib/guest-manager';

export default function ExamListPage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [timeFilter, setTimeFilter] = useState('ALL');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const { data: session } = useSession();

    useEffect(() => {
        async function fetchExamsAndStats() {
            try {
                // Parallel fetch
                const [examsData, recordsData] = await Promise.all([
                    getExams(),
                    (async () => {
                        const userId = session?.user?.id || guestManager.getGuestId();
                        if (userId) return await getLearningRecords(userId);
                        return [];
                    })()
                ]);

                if (examsData.length === 0) {
                    setErrorMsg('データが取得できませんでした (0件)。APIサーバが起動しているか確認してください。');
                }

                // Merge Stats
                const examsWithStats = examsData.map(exam => {
                    const examRecords = recordsData.filter(r => r.examId === exam.id);
                    const uniqueAnswered = new Set(examRecords.map(r => r.questionId)).size;
                    const correctCount = examRecords.filter(r => r.isCorrect).length;

                    // Simple logic: correctness based on total ATTEMPTS or distinct questions?
                    // Usually correct rate is (Total Correct / Total Attempts). 
                    // Let's use Total Attempts for correct rate, but Completed for Progress.

                    const totalAttempts = examRecords.length;
                    const correctRate = totalAttempts > 0 ? correctCount / totalAttempts : 0;

                    return {
                        ...exam,
                        stats: {
                            total: exam.stats.total || 80, // Fallback if 0
                            completed: uniqueAnswered,
                            correctRate: correctRate
                        }
                    };
                });

                setExams(examsWithStats);
            } catch (error) {
                console.error("Failed to load exams", error);
                setErrorMsg('取得エラーが発生しました。');
            } finally {
                setIsLoading(false);
            }
        }
        fetchExamsAndStats();
    }, [session]);

    const filteredExams = exams.filter(e => {
        const catMatch = filter === 'ALL' || e.category === filter;
        let timeMatch = true;

        if (timeFilter === 'AM') {
            timeMatch = e.id.includes('AM') || e.title.includes('\u5348\u524d'); // 午前
        } else if (timeFilter === 'PM') {
            const isAM = e.id.includes('AM') || e.title.includes('\u5348\u524d'); // 午前
            if (isAM) {
                timeMatch = false;
            } else {
                // 午後: Includes title '午後', ID ends with 'PM', ID contains '-PM', OR ID starts with 'PM-'/'SC-' (Project Manager/Security Specialist)
                timeMatch = e.title.includes('\u5348\u5f8c') || e.id.endsWith('PM') || e.id.includes('-PM') || e.id.startsWith('PM-') || e.id.startsWith('SC-');
            }
        }
        return catMatch && timeMatch;
    });

    if (isLoading) {
        return <div className={styles.container}><p>読み込み中...</p></div>;
    }

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
                        <div className={styles.filterButtons}>
                            <button onClick={() => setFilter('ALL')} className={`${styles.filterBtn} ${filter === 'ALL' ? styles.filterBtnSelected : ''}`}>すべて</button>
                            <button onClick={() => setFilter('AP')} className={`${styles.filterBtn} ${filter === 'AP' ? styles.filterBtnSelected : ''}`}>応用情報 (AP)</button>
                            <button onClick={() => setFilter('FE')} className={`${styles.filterBtn} ${filter === 'FE' ? styles.filterBtnSelected : ''}`}>基本情報 (FE)</button>
                            <button onClick={() => setFilter('PM')} className={`${styles.filterBtn} ${filter === 'PM' ? styles.filterBtnSelected : ''}`}>プロマネ (PM)</button>
                            <button onClick={() => setFilter('SC')} className={`${styles.filterBtn} ${filter === 'SC' ? styles.filterBtnSelected : ''}`}>安全確保支援士 (SC)</button>
                        </div>
                    </div>

                    {/* Time Filters */}
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>時間帯:</span>
                        <div className={styles.filterButtons}>
                            <button onClick={() => setTimeFilter('ALL')} className={`${styles.filterBtn} ${timeFilter === 'ALL' ? styles.filterBtnSelected : ''}`}>すべて</button>
                            <button onClick={() => setTimeFilter('AM')} className={`${styles.filterBtn} ${timeFilter === 'AM' ? styles.filterBtnSelected : ''}`}>午前 (AM)</button>
                            <button onClick={() => setTimeFilter('PM')} className={`${styles.filterBtn} ${timeFilter === 'PM' ? styles.filterBtnSelected : ''}`}>午後 (PM)</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.grid}>
                {errorMsg && (
                    <div style={{ gridColumn: '1/-1', padding: '20px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '20px' }}>
                        <strong>エラー:</strong> {errorMsg}<br />
                        <small>Debug: Loaded {exams.length} exams. Filtered matches: {filteredExams.length}</small>
                    </div>
                )}

                {filteredExams.length === 0 && !errorMsg ? (
                    <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        該当する試験区分は見つかりませんでした。<br />
                        <small>
                            Loaded: {exams.length} exams. Current Filter: {filter} / {timeFilter} <br />
                            IDs: {exams.map(e => e.id).join(', ')}
                        </small>
                    </p>
                ) : (
                    filteredExams.map((exam) => {
                        let startType = 'AM1';
                        if (exam.id.includes('AM2')) startType = 'AM2';
                        else if (exam.id.includes('PM1')) startType = 'PM1';
                        else if (exam.id.includes('PM2')) startType = 'PM2';
                        else if (exam.id.includes('PM') && !exam.id.startsWith('PM-')) startType = 'PM';

                        return (
                            <Link href={`/exam/${exam.id}/${startType}`} key={exam.id} className={styles.cardLink}>
                                <article className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <span className={styles.tag}>{exam.category}</span>
                                        <span className={styles.date}>{exam.date}</span>
                                    </div>
                                    <h3 className={styles.title}>{exam.title}</h3>

                                    <div className={styles.stats}>
                                        <div className={styles.statItem}>
                                            <span className={styles.statLabel}>進捗率</span>
                                            <span className={styles.statValue}>{Math.round((exam.stats.completed / exam.stats.total) * 100)}%</span>
                                        </div>
                                        <div className={styles.statItem}>
                                            <span className={styles.statLabel}>正答率</span>
                                            <span className={styles.statValue}>{Math.round(exam.stats.correctRate * 100)}%</span>
                                        </div>
                                    </div>

                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill} style={{ width: `${(exam.stats.completed / exam.stats.total) * 100}%` }}></div>
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
