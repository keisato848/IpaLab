'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { StudyPlan } from '../dashboard/GoalSettingWizard';
import { LearningRecord, getLearningRecords } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import Link from 'next/link';

export default function PlanViewer() {
    const { data: session, status } = useSession();
    const [plans, setPlans] = useState<StudyPlan[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});

    // 1. Load Plans
    useEffect(() => {
        const savedPlansStr = localStorage.getItem('studyPlans');
        let loadedPlans: StudyPlan[] = [];

        if (savedPlansStr) {
            try {
                loadedPlans = JSON.parse(savedPlansStr);
            } catch (e) { console.error(e); }
        } else {
            // Legacy fallback
            const legacy = localStorage.getItem('studyPlan');
            if (legacy) {
                try {
                    const p = JSON.parse(legacy);
                    if (!p.id) p.id = 'legacy';
                    loadedPlans = [p];
                } catch (e) { }
            }
        }

        setPlans(loadedPlans);
        if (loadedPlans.length > 0) {
            // Default to nearest future or last
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = today.getTime();

            const plansWithTimestamp = loadedPlans.map(p => ({
                ...p,
                examTimestamp: new Date(p.examDate).getTime()
            }));

            const sorted = plansWithTimestamp.sort((a, b) => a.examTimestamp - b.examTimestamp);
            const future = sorted.filter(p => p.examTimestamp >= todayTimestamp);
            const active = future.length > 0 ? future[0] : sorted[sorted.length - 1];
            setSelectedPlanId(active.id);
        }
    }, []);

    // 2. Load Progress Records
    useEffect(() => {
        async function loadRecords() {
            try {
                let fetchedRecords: LearningRecord[] = [];
                if (status === 'authenticated' && session?.user?.id) {
                    fetchedRecords = await getLearningRecords(session.user.id);
                } else {
                    fetchedRecords = guestManager.getHistory();
                }

                const counts: Record<string, number> = {};
                fetchedRecords.forEach(r => {
                    const dateKey = r.answeredAt.split('T')[0];
                    counts[dateKey] = (counts[dateKey] || 0) + 1;
                });
                setDailyCounts(counts);

            } catch (error) {
                console.error("Failed to load records", error);
            }
        }
        if (status !== 'loading') {
            loadRecords();
        }
    }, [status, session]);

    const activePlan = plans.find(p => p.id === selectedPlanId);

    const handleDelete = (id: string) => {
        if (!confirm("この計画を削除してもよろしいですか？")) return;
        const newPlans = plans.filter(p => p.id !== id);
        setPlans(newPlans);
        localStorage.setItem('studyPlans', JSON.stringify(newPlans));
        if (selectedPlanId === id) {
            setSelectedPlanId(newPlans.length > 0 ? newPlans[0].id : null);
        }
    };

    const handleUpdatePlan = (updatedPlan: StudyPlan) => {
        const newPlans = plans.map(p => p.id === updatedPlan.id ? updatedPlan : p);
        setPlans(newPlans);
        localStorage.setItem('studyPlans', JSON.stringify(newPlans));
    };

    if (plans.length === 0) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ marginBottom: '1rem' }}>学習計画がまだありません。</p>
                <Link href="/dashboard?action=replan" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>
                    ダッシュボードで計画を作成する
                </Link>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
            {/* Sidebar List */}
            <aside>
                <h3 style={{ marginBottom: '1rem' }}>計画一覧 ({plans.length})</h3>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {plans.map(p => (
                        <li key={p.id}>
                            <button
                                onClick={() => setSelectedPlanId(p.id)}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: selectedPlanId === p.id ? 'var(--bg-secondary)' : 'transparent',
                                    fontWeight: selectedPlanId === p.id ? 'bold' : 'normal',
                                    cursor: 'pointer',
                                    borderLeft: selectedPlanId === p.id ? '4px solid var(--primary-color)' : '4px solid transparent',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <div style={{ fontSize: '0.9rem' }}>{p.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.examDate}</div>
                            </button>
                        </li>
                    ))}
                </ul>
                <div style={{ marginTop: '1.5rem' }}>
                    <Link
                        href="/dashboard?action=replan"
                        style={{
                            display: 'block',
                            textAlign: 'center',
                            padding: '0.6rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            color: 'var(--primary-color)',
                            textDecoration: 'none',
                            fontSize: '0.9rem'
                        }}
                    >
                        + 新しい計画を作成
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main>
                {activePlan ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', flex: 1, marginRight: '1rem' }}>
                                <h2 style={{ margin: '0 0 1rem 0' }}>{activePlan.title}</h2>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    <span>受験日: {activePlan.examDate}</span>
                                    <span>作成日: {new Date(activePlan.generatedAt).toLocaleDateString()}</span>
                                </div>
                                <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                                    <strong>今月の目標:</strong> {activePlan.monthlyGoal}
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(activePlan.id)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem'
                                }}
                            >
                                削除
                            </button>
                        </div>

                        <h3 style={{ marginBottom: '1rem' }}>週間スケジュール</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {activePlan.weeklySchedule.map((week, i) => {
                                const hasTasks = week.dailyTasks && week.dailyTasks.length > 0;
                                const prevWeek = activePlan.weeklySchedule[i - 1];
                                const isTransitionWeek = !hasTasks && (prevWeek && prevWeek.dailyTasks && prevWeek.dailyTasks.length > 0);

                                return (
                                    <div key={i} style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                            <h4 style={{ margin: 0 }}>Week {week.weekNumber} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>({week.startDate} - {week.endDate})</span></h4>
                                        </div>
                                        <p style={{ fontWeight: 'bold', marginBottom: '1rem' }}>{week.goal}</p>

                                        {hasTasks ? (
                                            <div style={{ display: 'grid', gap: '0.8rem' }}>
                                                {week.dailyTasks.map((task, j) => {
                                                    const actual = dailyCounts[task.date] || 0;
                                                    const isMet = actual >= task.questionCount;
                                                    const remaining = task.questionCount - actual;
                                                    const todayStr = new Date().toISOString().split('T')[0];
                                                    const isPast = task.date < todayStr;
                                                    const isToday = task.date === todayStr;

                                                    return (
                                                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem', background: 'var(--bg-primary)', borderRadius: '8px', borderLeft: isMet ? '4px solid #10b981' : (isPast ? '4px solid #ef4444' : (isToday ? '4px solid #3b82f6' : '4px solid transparent')) }}>
                                                            <div style={{ width: '80px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                {task.date}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{task.goal}</div>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                                                    <span>目標: {task.questionCount}問 ({task.targetCategory})</span>
                                                                    {actual > 0 ? (
                                                                        <span style={{ fontWeight: 'bold', color: isMet ? '#10b981' : 'var(--text-primary)' }}>
                                                                            (実績: {actual}問)
                                                                        </span>
                                                                    ) : (
                                                                        isPast && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>(未達)</span>
                                                                    )}
                                                                </div>
                                                                {isPast && !isMet && remaining > 0 && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (!confirm(`${remaining}問を次の学習日に繰り越しますか？`)) return;
                                                                            const newPlan = JSON.parse(JSON.stringify(activePlan));
                                                                            let carried = false;
                                                                            for (let w = i; w < newPlan.weeklySchedule.length; w++) {
                                                                                const tasks = newPlan.weeklySchedule[w].dailyTasks || [];
                                                                                for (let t = (w === i ? j + 1 : 0); t < tasks.length; t++) {
                                                                                    tasks[t].questionCount += remaining;
                                                                                    carried = true; break;
                                                                                }
                                                                                if (carried) break;
                                                                            }
                                                                            if (carried) {
                                                                                newPlan.weeklySchedule[i].dailyTasks[j].questionCount = actual;
                                                                                newPlan.weeklySchedule[i].dailyTasks[j].goal += " (繰越済み)";
                                                                                handleUpdatePlan(newPlan);
                                                                            } else {
                                                                                alert("繰り越し先の予定が見つかりませんでした。");
                                                                            }
                                                                        }}
                                                                        style={{ marginTop: '0.5rem', background: 'none', border: '1px solid var(--text-secondary)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 8px' }}
                                                                    >
                                                                        残り{remaining}問を繰り越し ➔
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>詳細タスクは未生成です。</p>
                                                {isTransitionWeek && (
                                                    <button onClick={() => window.location.href = '/dashboard?action=replan'} style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: 'transparent', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                                                        続きを作成する
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        計画を選択してください。
                    </div>
                )}
            </main>
        </div>
    );
}
