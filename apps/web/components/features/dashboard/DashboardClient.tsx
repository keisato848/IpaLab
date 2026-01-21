'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { LearningRecord, getLearningRecords, getQuestions } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import { getExamLabel } from '@/lib/exam-utils';
import ThemeToggle from '@/components/common/ThemeToggle';
import HeatmapWidget from './HeatmapWidget';
import GoalSettingWizard, { StudyPlan } from './GoalSettingWizard';
import styles from './DashboardClient.module.css';

export default function DashboardClient() {
    const { data: session, status } = useSession();
    const [records, setRecords] = useState<LearningRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Goal Setting State
    const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
    const [allPlans, setAllPlans] = useState<StudyPlan[]>([]);
    const [showWizard, setShowWizard] = useState(false);

    const userName = session?.user?.name || "ゲスト";

    // 1. Load Data & Plan
    // 1. Load Data
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

    // 2. Load Plan & Check URL Action
    useEffect(() => {
        // Migration & Load Logic
        const savedPlansStr = localStorage.getItem('studyPlans');
        let allPlans: StudyPlan[] = [];

        if (savedPlansStr) {
            try {
                const parsed = JSON.parse(savedPlansStr);
                setAllPlans(parsed);
                allPlans = parsed;
            } catch (e) {
                console.error("Failed to parse studyPlans", e);
            }
        } else {
            // Check legacy single plan
            const legacyPlanStr = localStorage.getItem('studyPlan');
            if (legacyPlanStr) {
                try {
                    const legacyPlan = JSON.parse(legacyPlanStr);
                    // Add ID if missing (legacy)
                    if (!legacyPlan.id) legacyPlan.id = crypto.randomUUID();
                    allPlans = [legacyPlan];
                    setAllPlans(allPlans);
                    localStorage.setItem('studyPlans', JSON.stringify(allPlans));
                } catch (e) {
                    console.error("Failed to migrate legacy plan", e);
                }
            }
        }

        // Determine Active Plan
        // Strategy: 1. If URL has ?planId=... use that. 
        // 2. Else find nearest future exam.
        // 3. Else fallback to first.

        if (allPlans.length > 0) {
            // For now, just pick the first one or latest created? 
            // Better: Pick the one with closest future date.
            const sorted = [...allPlans].sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
            // Filter future or today
            const future = sorted.filter(p => new Date(p.examDate) >= new Date(new Date().setHours(0, 0, 0, 0)));

            const active = future.length > 0 ? future[0] : sorted[sorted.length - 1]; // Nearest future or latest past
            setStudyPlan(active);
        }

        // Check query param for replan trigger
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'replan') {
            setShowWizard(true);
            window.history.replaceState({}, '', '/dashboard');
        }
    }, []);

    // Job Polling Removed - using Sync API now

    const handleSavePlan = (plan: StudyPlan) => {
        setStudyPlan(plan);
        // Save to array
        const allPlansStr = localStorage.getItem('studyPlans');
        let allPlans: StudyPlan[] = allPlansStr ? JSON.parse(allPlansStr) : [];

        // Check if updating existing (by ID) -- though Wizard generates NEW ID currently. 
        // If we want to support "Edit", we need to pass ID to Wizard. 
        // For Re-plan, we usually Replace or Add New. 
        // If "Re-plan" means "Update schedule for same exam", maybe we should remove old one?
        // Let's just append for now to be safe (History). User can delete later.
        // Wait, if 10 re-plans, array grows. 
        // Better: Remove any existing plan for the SAME examId and SAME examDate? 
        // Or just by ID if updating.

        // Current Wizard generates NEW ID every time. 
        // Let's Append.
        allPlans.push(plan);
        localStorage.setItem('studyPlans', JSON.stringify(allPlans));

        setShowWizard(false);
    };

    // 3. Stats & Goals Logic
    const todayStr = new Date().toISOString().split('T')[0];

    // -- Filter Records Logic --
    // Convert 'ALL' selection to a boolean check
    const isAllPlans = studyPlan?.id === 'ALL';

    // Heper to get targetExam from plan (handling legacy)
    const getTargetExam = (p: StudyPlan) => {
        if (p.targetExam) return p.targetExam;
        // Legacy fallback
        if (p.title.includes('基本情報') || p.title.includes('FE')) return 'FE';
        if (p.title.includes('応用情報') || p.title.includes('AP')) return 'AP';
        if (p.title.includes('セキュ') || p.title.includes('SC')) return 'SC';
        if (p.title.includes('プロマネ') || p.title.includes('PM')) return 'PM';
        if (p.title.includes('ネット') || p.title.includes('NW')) return 'NW';
        if (p.title.includes('パスポート') || p.title.includes('IP')) return 'IP';
        return '';
    };

    const filteredRecords = useMemo(() => {
        if (isAllPlans) return records;
        if (!studyPlan) return records;

        const target = getTargetExam(studyPlan);

        // Determine the start date for filtering
        let planStart: Date | null = null;
        const startDateStr = studyPlan.weeklySchedule?.[0]?.startDate;
        if (startDateStr) {
            planStart = new Date(startDateStr);
            planStart.setHours(0, 0, 0, 0);
        } else if (studyPlan.generatedAt) {
            planStart = new Date(studyPlan.generatedAt);
            planStart.setHours(0, 0, 0, 0);
        }

        return records.filter(r => {
            // 1. Exam Type Filter
            if (target && !r.examId.startsWith(target)) return false;

            // 2. Date Filter
            if (planStart) {
                const recordDate = new Date(r.answeredAt);
                if (recordDate < planStart) return false;
            }

            return true;
        });
    }, [records, studyPlan, isAllPlans]);

    // -- Goal Logic --
    let todayTargetCount = 10;
    let todayGoalLabel = "学習を進めましょう";
    let todayCategoryLabel = "全般";

    if (isAllPlans) {
        // Aggregate targets from all plans
        let totalCount = 0;
        allPlans.forEach(p => {
            const tData = p.weeklySchedule?.flatMap(w => w.dailyTasks)?.find(t => t.date === todayStr);
            if (tData) totalCount += tData.questionCount;
        });
        todayTargetCount = totalCount > 0 ? totalCount : 10;
        todayGoalLabel = "全計画の合計目標";
        todayCategoryLabel = "合計";
    } else {
        // Single Plan
        const todayGoalData = studyPlan?.weeklySchedule
            ?.flatMap(w => w.dailyTasks)
            ?.find(t => t.date === todayStr);

        if (todayGoalData) {
            todayTargetCount = todayGoalData.questionCount;
            todayGoalLabel = todayGoalData.goal;
            todayCategoryLabel = todayGoalData.targetCategory;
        }
    }

    // Weekly Data (Only meaningful for single plan, or we could aggregate)
    const currentWeekData = !isAllPlans ? studyPlan?.weeklySchedule?.find(w =>
        todayStr >= w.startDate && todayStr <= w.endDate
    ) : null;


    const todayRecords = useMemo(() => {
        const today = new Date().toDateString();
        return filteredRecords.filter(r => new Date(r.answeredAt).toDateString() === today);
    }, [filteredRecords]);
    const todayCount = todayRecords.length;
    const progressPercent = Math.min(100, Math.round((todayCount / todayTargetCount) * 100));

    const statsRecords = useMemo(() => filteredRecords, [filteredRecords]);
    const recentRecords = useMemo(() => filteredRecords.slice(0, 5), [filteredRecords]);

    // 4. Quick Start Logic
    const [quickStartUrl, setQuickStartUrl] = useState("/exam");
    const [quickStartLabel, setQuickStartLabel] = useState("クイックスタート (続きから)");

    useEffect(() => {
        if (statsRecords.length === 0) {
            const defaultExam = studyPlan && !isAllPlans ? getTargetExam(studyPlan) : 'AP';
            // Default URL if no history
            setQuickStartUrl(`/exam?active=${defaultExam}`);
            return;
        }
        const lastRecord = statsRecords[0];
        if (!lastRecord.examId || !lastRecord.questionId) return;

        const parts = lastRecord.examId.split('-');
        if (parts.length < 2) return;

        const typeSuffix = parts[parts.length - 1];
        const yearPart = parts.slice(0, parts.length - 1).join('-');
        const typeUrl = typeSuffix === 'AM' ? 'AM1' : typeSuffix;

        const qIdParts = lastRecord.questionId?.split('-') || [];
        const lastQNo = parseInt(qIdParts[qIdParts.length - 1] || '0');
        const nextQNo = lastQNo + 1;

        // Simple fallback url construction
        setQuickStartUrl(`/exam/${yearPart}/${typeUrl}/${nextQNo}?mode=practice`);
    }, [statsRecords, studyPlan, isAllPlans]);

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
                    <div className={styles.headerActions}>
                        <div className={styles.dateDisplay}>
                            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}
                        </div>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <div className={styles.grid}>
                {/* 1. Goal Section (Hierarchical) */}
                <section className={`${styles.card} ${styles.statusCard} ${styles.fullWidthCard}`}>
                    <div className={styles.cardHeader} style={{ justifyContent: 'space-between', display: 'flex' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <h3>学習目標</h3>
                            {allPlans.length > 0 && (
                                <select
                                    className={styles.planSwitcher}
                                    value={studyPlan?.id || 'ALL'}
                                    onChange={(e) => {
                                        if (e.target.value === 'ALL') {
                                            // Virtual "ALL" plan
                                            setStudyPlan({ id: 'ALL' } as any);
                                        } else {
                                            const selected = allPlans.find(p => p.id === e.target.value);
                                            if (selected) setStudyPlan(selected);
                                        }
                                    }}
                                    style={{
                                        fontSize: '0.9rem',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {allPlans.length > 1 && <option value="ALL">すべて (合算)</option>}
                                    {allPlans.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.title} ({new Date(p.examDate).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <span className={styles.cardIcon}>🚀</span>
                    </div>
                    {studyPlan ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                            {/* Monthly */}
                            {!isAllPlans && (
                                <div style={{ flex: 1, minWidth: '250px', padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>今月の目標</div>
                                    <div style={{ fontWeight: 'bold' }}>{studyPlan.monthlyGoal}</div>
                                </div>
                            )}

                            {/* Weekly */}
                            {!isAllPlans && (
                                <div style={{ flex: 1, minWidth: '250px', padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                        今週のテーマ {currentWeekData ? `(Week ${currentWeekData.weekNumber})` : ''}
                                    </div>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {currentWeekData?.goal || "予定なし"}
                                    </div>
                                </div>
                            )}

                            {/* Daily (Today) */}
                            <div style={{ flex: 1, minWidth: '250px', padding: '0.8rem', background: 'var(--bg-primary)', borderRadius: '8px', border: '2px solid var(--primary-color)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', marginBottom: '0.3rem', fontWeight: 'bold' }}>{isAllPlans ? '今日の合計ミッション' : '今日のミッション'}</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    {todayGoalLabel}
                                </div>
                                <div style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
                                    目標: <strong>{todayTargetCount}問</strong> <span style={{ fontSize: '0.8rem' }}>({todayCategoryLabel})</span>
                                </div>
                            </div>

                            <div style={{ width: '100%', marginTop: '0.5rem' }}>
                                <button
                                    onClick={() => setShowWizard(true)}
                                    className={styles.quickStartBtn}
                                    style={{ width: 'auto', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', boxShadow: 'none', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                >
                                    計画を見直す
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                            <p style={{ marginBottom: '1rem', opacity: 0.9 }}>まだ目標が設定されていません。<br />AIと一緒に最適な学習プランを作りましょう。</p>
                            <button
                                onClick={() => setShowWizard(true)}
                                className={styles.quickStartBtn}
                            >
                                目標を設定する
                            </button>
                        </div>
                    )}
                </section>

                {/* 2. Today's Status (Linked to Goal) */}
                <section className={`${styles.card} ${styles.statusCard}`}>
                    <div className={styles.cardHeader}>
                        <h3>今日の進捗 {isAllPlans ? '(全体)' : ''}</h3>
                        <span className={styles.cardIcon}>🎯</span>
                    </div>
                    <div className={styles.progressContainer}>
                        <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <div className={styles.progressStats}>
                            <span className={styles.progressText}>{todayCount} / {todayTargetCount} 問</span>
                            <span className={styles.progressPercent}>{progressPercent}%</span>
                        </div>
                    </div>
                    <Link href={quickStartUrl} className={styles.quickStartBtn}>{quickStartLabel}</Link>
                </section>

                {/* 3. Overall Accuracy Card */}
                <section className={`${styles.card} ${styles.statusCard}`} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}>
                    <div className={styles.cardHeader}>
                        <h3 style={{ color: 'white' }}>通算正答率 {isAllPlans ? '(全体)' : ''}</h3>
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
                                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - (statsRecords.length > 0 ? (statsRecords.filter(r => r.isCorrect).length / statsRecords.length) : 0))}`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 50 50)"
                                />
                            </svg>
                            <div style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {statsRecords.length > 0 ? Math.round((statsRecords.filter(r => r.isCorrect).length / statsRecords.length) * 100) : 0}%
                            </div>
                        </div>

                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.2rem' }}>正解数</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', lineHeight: 1 }}>
                                {statsRecords.filter(r => r.isCorrect).length} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', opacity: 0.8 }}>/ {statsRecords.length}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. Heatmap Widget (Replaces placeholders) */}
                <section className={`${styles.card} ${styles.heatmapCard}`}>
                    <HeatmapWidget records={records} />
                </section>

                {/* 5. Recent History */}
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
                                        <span className={styles.examName}>{getExamLabel(r.examId)} Q{r.questionId?.split('-').pop() || '?'}</span>
                                    </div>
                                    <div className={styles.historyMeta}>
                                        <span className={`${styles.result} ${r.isCorrect ? styles.correct : styles.incorrect}`}>
                                            {r.isCorrect ? '正解' : '不正解'}
                                        </span>
                                        <span className={styles.date}>
                                            {new Date(r.answeredAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {showWizard && (
                <GoalSettingWizard
                    onClose={() => setShowWizard(false)}
                    onSave={handleSavePlan}
                />
            )}
        </div>
    );
}
