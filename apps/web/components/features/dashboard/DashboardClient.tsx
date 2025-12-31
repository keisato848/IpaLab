'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { LearningRecord, getLearningRecords, getQuestions } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import { getExamLabel } from '@/lib/exam-utils';
import ThemeToggle from '@/components/common/ThemeToggle';
import HeatmapWidget from './HeatmapWidget';
import styles from './DashboardClient.module.css';

export default function DashboardClient() {
    const { data: session, status } = useSession();
    const [records, setRecords] = useState<LearningRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const userName = session?.user?.name || "ゲスト";

    useEffect(() => {
        async function loadData() {
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
            } catch (error) {
                console.error("Failed to load dashboard data", error);
            } finally {
                setLoading(false);
            }
        }

        if (status !== 'loading') {
            loadData();
        }
    }, [status, session]);

    // Stats Calculation
    const today = new Date().toDateString();
    const todayRecords = records.filter(r => new Date(r.answeredAt).toDateString() === today);
    const todayCount = todayRecords.length;
    const todayGoal = 10;
    const progressPercent = Math.min(100, Math.round((todayCount / todayGoal) * 100));

    const recentRecords = records.slice(0, 5);

    // Quick Start Logic
    const [quickStartUrl, setQuickStartUrl] = useState("/exam");
    const [quickStartLabel, setQuickStartLabel] = useState("クイックスタート (続きから)");

    useEffect(() => {
        async function determineQuickStart() {
            if (records.length === 0) {
                setQuickStartUrl("/exam");
                return;
            }

            const lastRecord = records[0];
            const parts = lastRecord.examId.split('-'); // AP-2023-Fall-AM
            const typeSuffix = parts[parts.length - 1]; // "AM"
            const yearPart = parts.slice(0, parts.length - 1).join('-'); // "AP-2023-Fall"
            const typeUrl = typeSuffix === 'AM' ? 'AM1' : typeSuffix;

            const lastQNo = parseInt(lastRecord.questionId.split('-').pop() || '0');
            const nextQNo = lastQNo + 1;

            try {
                // If we assume a fixed number, it's faster, but fetching questions is safer.
                const questions = await getQuestions(lastRecord.examId);
                if (nextQNo > questions.length) {
                    setQuickStartUrl(`/exam/${yearPart}/${typeUrl}/result?mode=practice`);
                    setQuickStartLabel("結果を確認する");
                } else {
                    setQuickStartUrl(`/exam/${yearPart}/${typeUrl}/${nextQNo}?mode=practice`);
                    setQuickStartLabel("クイックスタート (続きから)");
                }
            } catch (e) {
                // Fallback
                setQuickStartUrl(`/exam/${yearPart}/${typeUrl}/${nextQNo}?mode=practice`);
            }
        }

        if (records.length > 0) {
            determineQuickStart();
        }
    }, [records]);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.welcomeText}>
                        <h1>こんにちは、{userName}さん 👋</h1>
                        <p className={styles.subtitle}>今日も一日、知識を積み重ねましょう。</p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.dateDisplay}>
                        {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}
                    </div>
                    <ThemeToggle />
                </div>
            </header>

            <div className={styles.grid}>
                {/* Today's Status */}
                <section className={`${styles.card} ${styles.statusCard}`}>
                    <div className={styles.cardHeader}>
                        <h3>今日の目標</h3>
                        <span className={styles.cardIcon}>🎯</span>
                    </div>
                    <div className={styles.progressContainer}>
                        <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <div className={styles.progressStats}>
                            <span className={styles.progressText}>{todayCount} / {todayGoal} 問</span>
                            <span className={styles.progressPercent}>{progressPercent}%</span>
                        </div>
                    </div>
                    <Link href={quickStartUrl} className={styles.quickStartBtn}>{quickStartLabel}</Link>
                </section>

                {/* Overall Accuracy Card */}
                <section className={`${styles.card} ${styles.statusCard}`} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}>
                    <div className={styles.cardHeader}>
                        <h3 style={{ color: 'white' }}>通算正答率</h3>
                        <span className={styles.cardIcon}>📊</span>
                    </div>
                    <div className={styles.progressContainer} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '0.5rem 0' }}>
                        {/* Donut Chart - Compact Size */}
                        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                            <svg width="80" height="80" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="transparent"
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth="12"
                                />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="transparent"
                                    stroke="white"
                                    strokeWidth="12"
                                    strokeDasharray={`${2 * Math.PI * 40}`}
                                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - (records.length > 0 ? (records.filter(r => r.isCorrect).length / records.length) : 0))}`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 50 50)"
                                />
                            </svg>
                            <div style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {records.length > 0 ? Math.round((records.filter(r => r.isCorrect).length / records.length) * 100) : 0}%
                            </div>
                        </div>

                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.2rem' }}>正解数</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', lineHeight: 1 }}>
                                {records.filter(r => r.isCorrect).length} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', opacity: 0.8 }}>/ {records.length}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Heatmap Widget (Replaces placeholders) */}
                <section className={`${styles.card} ${styles.heatmapCard}`}>
                    <HeatmapWidget records={records} />
                </section>

                {/* Recent History */}
                <section className={`${styles.card} ${styles.historyCard}`}>
                    <div className={styles.cardHeader}>
                        <h3>最近の活動</h3>
                        <Link href="/history" className={styles.viewAllBtn}>すべて見る</Link>
                    </div>
                    {recentRecords.length === 0 ? (
                        <p className={styles.subtitle}>まだ学習履歴がありません。</p>
                    ) : (
                        <ul className={styles.historyList}>
                            {recentRecords.map((r, i) => (
                                <li key={i} className={styles.historyItem}>
                                    <div className={styles.historyMain}>
                                        <span className={styles.tag}>{r.category || '未分類'}</span>
                                        <span className={styles.examName}>{getExamLabel(r.examId)} Q{r.questionId.split('-').pop()}</span>
                                    </div>
                                    <div className={styles.historyMeta}>
                                        <span className={`${styles.result} ${r.isCorrect ? styles.correct : styles.incorrect}`}>
                                            {r.isCorrect ? '正解' : '不正解'}
                                        </span>
                                        <span className={styles.date}>
                                            {new Date(r.answeredAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
