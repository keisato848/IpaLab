'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { LearningRecord, getLearningRecords, getQuestions } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
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
                <div className={styles.welcomeText}>
                    <h1>こんにちは、{userName}さん 👋</h1>
                    <p className={styles.subtitle}>今日も一日、知識を積み重ねましょう。</p>
                </div>
                <div className={styles.dateDisplay}>
                    {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
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

                {/* Analytics: Radar Chart Stub */}
                <section className={`${styles.card} ${styles.radarCard}`}>
                    <h3>弱点分析</h3>
                    <div className={styles.chartPlaceholder}>
                        <div className={styles.chartStubCircle}>
                            <span>分析データ不足</span>
                        </div>
                        <p className={styles.chartNote}>問題を解くと、ここに分野別の得意・不得意が表示されます。</p>
                    </div>
                </section>

                {/* Analytics: Line Chart Stub */}
                <section className={`${styles.card} ${styles.lineCard}`}>
                    <h3>成長推移</h3>
                    <div className={styles.chartPlaceholder}>
                        <div className={styles.chartStubGraph}></div>
                        <p className={styles.chartNote}>日々の正解率の推移がここにグラフ化されます。</p>
                    </div>
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
                                        <span className={styles.examName}>{r.examId} Q{r.questionId.split('-').pop()}</span>
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
