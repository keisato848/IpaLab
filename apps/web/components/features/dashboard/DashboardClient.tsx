'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { LearningRecord, getLearningRecords, getQuestions, StudyPlanJob } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import { getExamLabel } from '@/lib/exam-utils';
import ThemeToggle from '@/components/common/ThemeToggle';
import { useUserProgress } from '@/hooks/useUserProgress';
import HeatmapWidget from './HeatmapWidget';
import GoalSettingWizard, { StudyPlan } from './GoalSettingWizard';
import PlanReadyNotification from './PlanReadyNotification';
import styles from './DashboardClient.module.css';

export default function DashboardClient() {
    const { data: session, status } = useSession();
    const [records, setRecords] = useState<LearningRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Goal Setting State
    const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
    const [allPlans, setAllPlans] = useState<StudyPlan[]>([]);
    const [showWizard, setShowWizard] = useState(false);
    const [pendingJob, setPendingJob] = useState<StudyPlanJob | null>(null);
    const {
        progress,
        achievements,
        levelInfo,
        achievementTotal,
        completeMission,
        updateAchievementProgress,
        lastMissionReward,
        lastLevelUp,
        clearMissionReward,
        clearLevelUp
    } = useUserProgress();

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
                // Filter out records with invalid or missing answeredAt
                const validRecords = fetchedRecords.filter(r => r && r.answeredAt);
                // Sort by answeredAt desc
                validRecords.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
                setRecords(validRecords);
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

    // 2.5. Check for pending completed jobs (async job notification)
    useEffect(() => {
        async function checkPendingJobs() {
            if (status !== 'authenticated') return;
            
            try {
                const res = await fetch('/api/ai/jobs/pending');
                if (res.ok) {
                    const jobs = await res.json();
                    if (jobs && jobs.length > 0) {
                        // Show notification for the most recent completed job
                        setPendingJob(jobs[0]);
                    }
                }
            } catch (e) {
                console.error('Failed to check pending jobs:', e);
            }
        }

        checkPendingJobs();
    }, [status]);

    // Handle async job created callback
    const handleAsyncJobCreated = (jobId: string) => {
        console.log('Async job created:', jobId);
        setShowWizard(false);
        // Could show a toast notification here
    };

    // Handle applying plan from notification
    const handleApplyPlanFromNotification = (planData: any) => {
        const plan: StudyPlan = {
            ...planData,
            id: crypto.randomUUID(),
        };
        handleSavePlan(plan);
        setPendingJob(null);
    };

    // Handle dismissing notification
    const handleDismissNotification = () => {
        setPendingJob(null);
    };

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

    // Filter records: If isAllPlans, show all. Else filter by targetExam prefix AND date (start of plan).
    const filteredRecords = records.filter(r => {
        // Validate record has required fields
        if (!r || !r.answeredAt) return false;
        
        if (isAllPlans) return true;
        if (!studyPlan) return true;

        // 1. Exam Type Filter
        const target = getTargetExam(studyPlan);
        if (target && !r.examId?.startsWith(target)) return false;

        // 2. Date Filter (Scope to plan duration)
        // Use weeklySchedule start date (inclusive of the whole start day)
        // If missing, fallback to generatedAt (which might exclude earlier answers on same day, so prefer Schedule)
        const startDateStr = studyPlan.weeklySchedule?.[0]?.startDate;
        if (startDateStr) {
            // startDateStr is YYYY-MM-DD. 
            // We want to include everything from that day 00:00:00 onwards.
            // Since records are stored in UTC/ISO, we need safe comparison.
            // Simplest: Compare YYYY-MM-DD strings in local time? 
            // Records.answeredAt is ISO.
            // Let's assume startDateStr represents user's local start day.

            // Create Midnight Date object for Start Date
            const planStart = new Date(startDateStr);
            planStart.setHours(0, 0, 0, 0);

            const recordDate = new Date(r.answeredAt);
            if (recordDate < planStart) return false;
        } else if (studyPlan.generatedAt) {
            const genDate = new Date(studyPlan.generatedAt);
            // aggressive fallback: start of that day
            genDate.setHours(0, 0, 0, 0);
            const recordDate = new Date(r.answeredAt);
            if (recordDate < genDate) return false;
        }

        return true;
    });

    const totalAnswered = records.length;
    const categoryAccuracy = useMemo(() => {
        const categoryStats = new Map<string, { total: number; correct: number }>();
        records.forEach(record => {
            const category = record.category || 'unknown';
            const entry = categoryStats.get(category) || { total: 0, correct: 0 };
            entry.total += 1;
            if (record.isCorrect) entry.correct += 1;
            categoryStats.set(category, entry);
        });

        const accuracyMap: Record<string, number> = {};
        categoryStats.forEach((value, key) => {
            accuracyMap[key] = value.total > 0 ? value.correct / value.total : 0;
        });
        return accuracyMap;
    }, [records]);

    useEffect(() => {
        updateAchievementProgress({ totalAnswered, categoryAccuracy });
    }, [categoryAccuracy, totalAnswered, updateAchievementProgress]);

    // -- Goal Logic (ゲーミフィケーション対応) --
    let todayTargetCount = 10;
    let todayMissionTitle = "学習を進めましょう";
    let todayGoalLabel = "今日のミッションをクリアしよう！";
    let todayCategoryLabel = "全般";
    let todayDifficulty: 'easy' | 'normal' | 'hard' = 'normal';
    let todayXpReward = 30;
    let todayTaskCompleted = false;
    const todayGoalData = !isAllPlans
        ? studyPlan?.weeklySchedule?.flatMap(w => w.dailyTasks || [])?.filter(t => t)?.find(t => t.date === todayStr)
        : undefined;

    if (isAllPlans) {
        // Aggregate targets from all plans
        let totalCount = 0;
        let totalXp = 0;
        allPlans.forEach(p => {
            const tData = p.weeklySchedule?.flatMap(w => w.dailyTasks || [])?.filter(t => t)?.find(t => t.date === todayStr);
            if (tData) {
                totalCount += tData.questionCount;
                totalXp += tData.xpReward || 30;
            }
        });
        todayTargetCount = totalCount > 0 ? totalCount : 10;
        todayMissionTitle = "🎯 全計画合計ミッション";
        todayGoalLabel = "すべての計画のタスクを消化しよう";
        todayCategoryLabel = "合計";
        todayXpReward = totalXp || 50;
    } else {
        // Single Plan
        if (todayGoalData) {
            todayTargetCount = todayGoalData.questionCount;
            todayMissionTitle = todayGoalData.missionTitle || todayGoalData.goal || "今日のミッション";
            todayGoalLabel = todayGoalData.goal || "学習を進めましょう";
            todayCategoryLabel = todayGoalData.targetCategory || "全般";
            todayDifficulty = todayGoalData.difficulty || 'normal';
            todayXpReward = todayGoalData.xpReward || 30;
            todayTaskCompleted = todayGoalData.isCompleted || false;
        }
    }

    // Weekly Data (Only meaningful for single plan, or we could aggregate)
    const currentWeekData = !isAllPlans ? studyPlan?.weeklySchedule?.find(w =>
        todayStr >= w.startDate && todayStr <= w.endDate
    ) : null;

    // 週のテーマとゴール
    const weekTheme = currentWeekData?.theme || currentWeekData?.goal || "今週の学習";
    const weekGoal = currentWeekData?.goal || "週間目標未設定";

    const today = new Date().toDateString();
    const todayRecords = filteredRecords.filter(r => new Date(r.answeredAt).toDateString() === today);
    const todayCount = todayRecords.length;
    const progressPercent = Math.min(100, Math.round((todayCount / todayTargetCount) * 100));
    
    // ミッションクリア判定
    const isMissionComplete = todayCount >= todayTargetCount;

    useEffect(() => {
        if (!studyPlan || isAllPlans || !todayGoalData) return;
        if (!isMissionComplete || todayTaskCompleted) return;

        const result = completeMission({
            date: todayStr,
            planId: studyPlan.id,
            missionTitle: todayMissionTitle,
            baseXp: todayXpReward,
            metrics: {
                todayRecords: todayRecords.map(record => ({
                    isCorrect: record.isCorrect,
                    category: record.category
                })),
                totalAnswered,
                categoryAccuracy
            }
        });

        if (result.alreadyCompleted) return;

        const storedPlansStr = localStorage.getItem('studyPlans');
        if (!storedPlansStr) return;
        try {
            const parsedPlans: StudyPlan[] = JSON.parse(storedPlansStr);
            const updatedPlans = parsedPlans.map(plan => {
                if (plan.id !== studyPlan.id) return plan;
                return {
                    ...plan,
                    weeklySchedule: (plan.weeklySchedule || []).map(week => ({
                        ...week,
                        dailyTasks: (week.dailyTasks || []).map(task => {
                            if (!task || task.date !== todayStr) return task;
                            return { ...task, isCompleted: true };
                        })
                    }))
                };
            });
            localStorage.setItem('studyPlans', JSON.stringify(updatedPlans));
            setAllPlans(updatedPlans);
            const refreshed = updatedPlans.find(plan => plan.id === studyPlan.id) || studyPlan;
            setStudyPlan(refreshed);
        } catch (error) {
            console.error("Failed to update studyPlans completion state", error);
        }
    }, [
        studyPlan,
        isAllPlans,
        todayGoalData,
        isMissionComplete,
        todayTaskCompleted,
        todayStr,
        todayMissionTitle,
        todayXpReward,
        todayRecords,
        totalAnswered,
        categoryAccuracy,
        completeMission
    ]);

    // 難易度に応じたスタイル
    const getDifficultyStyle = (diff: string) => {
        switch (diff) {
            case 'easy': return { bg: '#22c55e', label: '🟢 Easy' };
            case 'hard': return { bg: '#ef4444', label: '🔴 Hard' };
            default: return { bg: '#f59e0b', label: '🟡 Normal' };
        }
    };

    // Use filtered records for stats
    const statsRecords = filteredRecords;

    // Recent History (Global or filtered based on preference? Usually "Recent Activity" is global log)
    // User requested "Select plan... filter records". So history list should probably also follow suit?
    // Let's keep History list consistent with the filtered specific view.
    const recentRecords = filteredRecords.slice(0, 5);

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
                <section className={`${styles.card} ${styles.levelCard} ${styles.fullWidthCard}`}>
                    <div className={styles.levelHeader}>
                        <div>
                            <div className={styles.levelTitle}>
                                Level {levelInfo.level} - {levelInfo.title}
                            </div>
                            <div className={styles.levelXp}>XP: {progress.totalXp.toLocaleString()}</div>
                        </div>
                        <div className={styles.levelMeta}>
                            <span>🔥 連続学習: {progress.streakDays}日目</span>
                            <span>🏆 実績: {achievements.unlocked.length}/{achievementTotal}</span>
                        </div>
                    </div>
                    <div className={styles.levelBar}>
                        <div
                            className={styles.levelFill}
                            style={{ width: `${levelInfo.progressPercent}%` }}
                        />
                    </div>
                    <div className={styles.levelNext}>次のレベルまで {levelInfo.xpToNext} XP</div>
                </section>
                {/* 1. Goal Section (Hierarchical) - ゲーミフィケーション対応 */}
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
                        <span className={styles.cardIcon} style={{ cursor: 'pointer' }} onClick={() => setShowWizard(true)}>✏️</span>
                    </div>
                    {studyPlan ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                            {/* Monthly Goal */}
                            {!isAllPlans && (
                                <div style={{ flex: 1, minWidth: '250px', padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>📅 今月の目標</div>
                                    <div style={{ fontWeight: 'bold' }}>{studyPlan.monthlyGoal}</div>
                                </div>
                            )}

                            {/* Weekly Theme */}
                            {!isAllPlans && (
                                <div style={{ flex: 1, minWidth: '250px', padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                        🎯 今週のテーマ {currentWeekData ? `(Week ${currentWeekData.weekNumber})` : ''}
                                    </div>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {weekTheme}
                                    </div>
                                </div>
                            )}

                            {/* Today's Mission - ゲーム風デザイン */}
                            <div style={{ 
                                flex: 1, 
                                minWidth: '250px', 
                                padding: '1rem', 
                                background: isMissionComplete 
                                    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' 
                                    : 'linear-gradient(135deg, var(--primary-color) 0%, #6366f1 100%)', 
                                borderRadius: '12px', 
                                color: 'white',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* 完了時のエフェクト */}
                                {isMissionComplete && (
                                    <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '1.5rem' }}>🏆</div>
                                )}
                                
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.5rem',
                                    marginBottom: '0.5rem'
                                }}>
                                    <span style={{ 
                                        fontSize: '0.7rem', 
                                        fontWeight: 'bold',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: getDifficultyStyle(todayDifficulty).bg
                                    }}>
                                        {getDifficultyStyle(todayDifficulty).label}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>今日のミッション</span>
                                </div>
                                
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                    {isMissionComplete ? '✅ ミッションクリア！' : todayMissionTitle}
                                </div>
                                
                                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                                    {todayGoalLabel}
                                </div>
                                
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    marginTop: '0.5rem',
                                    paddingTop: '0.5rem',
                                    borderTop: '1px solid rgba(255,255,255,0.2)'
                                }}>
                                    <span style={{ fontSize: '0.85rem' }}>
                                        🎯 目標: <strong>{todayTargetCount}問</strong>
                                        <span style={{ fontSize: '0.75rem', marginLeft: '0.3rem', opacity: 0.8 }}>({todayCategoryLabel})</span>
                                    </span>
                                    <span style={{ 
                                        fontSize: '0.85rem', 
                                        fontWeight: 'bold',
                                        background: 'rgba(255,255,255,0.2)',
                                        padding: '2px 8px',
                                        borderRadius: '4px'
                                    }}>
                                        ⭐ +{todayXpReward} XP
                                    </span>
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

                {/* 2. Today's Status - ゲーミフィケーション対応 */}
                <section className={`${styles.card} ${styles.statusCard}`}>
                    <div className={styles.cardHeader}>
                        <h3>今日の進捗</h3>
                        <span className={styles.cardIcon}>{isMissionComplete ? '🏆' : '🎯'}</span>
                    </div>
                    <div className={styles.progressContainer}>
                        <div className={styles.progressBar} style={{ 
                            background: 'var(--bg-secondary)',
                            height: '12px',
                            borderRadius: '6px',
                            overflow: 'hidden'
                        }}>
                            <div 
                                className={styles.progressFill} 
                                style={{ 
                                    width: `${progressPercent}%`,
                                    height: '100%',
                                    background: isMissionComplete 
                                        ? 'linear-gradient(90deg, #22c55e, #16a34a)' 
                                        : progressPercent >= 80 
                                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                            : 'linear-gradient(90deg, var(--primary-color), #6366f1)',
                                    transition: 'width 0.5s ease-out'
                                }}
                            />
                        </div>
                        <div className={styles.progressStats} style={{ marginTop: '0.5rem' }}>
                            <span className={styles.progressText}>
                                {isMissionComplete && '✅ '}{todayCount} / {todayTargetCount} 問
                            </span>
                            <span className={styles.progressPercent} style={{
                                color: isMissionComplete ? '#22c55e' : 'var(--text-primary)',
                                fontWeight: 'bold'
                            }}>
                                {progressPercent}%
                            </span>
                        </div>
                        {isMissionComplete && (
                            <div style={{ 
                                textAlign: 'center', 
                                marginTop: '0.5rem',
                                padding: '0.3rem 0.6rem',
                                background: 'rgba(34, 197, 94, 0.1)',
                                borderRadius: '4px',
                                color: '#22c55e',
                                fontSize: '0.85rem',
                                fontWeight: 'bold'
                            }}>
                                🎉 ミッションクリア！ +{todayXpReward} XP 獲得
                            </div>
                        )}
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
                                            {r.answeredAt ? new Date(r.answeredAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {lastMissionReward && (
                <div className={styles.missionOverlay} onClick={clearMissionReward}>
                    <div className={styles.missionPopup} onClick={(e) => e.stopPropagation()}>
                        <h3 className={styles.missionTitle}>🎉 ミッションクリア！</h3>
                        <p className={styles.missionSubtitle}>{todayMissionTitle}</p>
                        <div className={styles.missionXpRow}>
                            <span>⭐ +{lastMissionReward.xpEarned} XP</span>
                            <span>🔥 連続ボーナス +{lastMissionReward.bonusXp} XP</span>
                        </div>
                        {lastMissionReward.achievementXp > 0 && (
                            <div className={styles.missionXpRow}>
                                <span>🏆 実績ボーナス +{lastMissionReward.achievementXp} XP</span>
                            </div>
                        )}
                        <div className={styles.missionTotal}>
                            合計: +{lastMissionReward.totalXpEarned} XP
                        </div>
                        <button className={styles.missionButton} onClick={clearMissionReward}>次のミッションへ</button>
                    </div>
                </div>
            )}

            {lastLevelUp && (
                <div className={styles.levelOverlay} onClick={clearLevelUp}>
                    <div className={styles.levelModal} onClick={(e) => e.stopPropagation()}>
                        <h3 className={styles.levelUpTitle}>✨ LEVEL UP! ✨</h3>
                        <div className={styles.levelUpBody}>
                            <div className={styles.levelUpLevel}>Level {lastLevelUp.level}</div>
                            <div className={styles.levelUpTitleText}>「{lastLevelUp.title}」</div>
                            <p className={styles.levelUpMessage}>
                                これまでの努力が実を結びました！この調子で合格を目指しましょう！
                            </p>
                        </div>
                        <button className={styles.levelUpButton} onClick={clearLevelUp}>OK</button>
                    </div>
                </div>
            )}

            {showWizard && (
                <GoalSettingWizard
                    onClose={() => setShowWizard(false)}
                    onSave={handleSavePlan}
                    onAsyncJobCreated={handleAsyncJobCreated}
                />
            )}

            {pendingJob && (
                <PlanReadyNotification
                    job={pendingJob}
                    onApply={handleApplyPlanFromNotification}
                    onDismiss={handleDismissNotification}
                />
            )}
        </div>
    );
}
