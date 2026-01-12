'use client';

import { useState, useEffect } from 'react';
import styles from './GoalSettingWizard.module.css';

export interface StudyPlan {
    id: string; // Unique ID for multi-plan support
    title: string;
    targetExam: string; // Added for filtering
    examDate: string;
    monthlyGoal: string;
    weeklySchedule: {
        weekNumber: number;
        startDate: string;
        endDate: string;
        goal: string;
        dailyTasks: {
            date: string;
            goal: string;
            questionCount: number;
            targetCategory: string;
            targetExamId?: string;
        }[];
    }[];
    generatedAt: string;
}

interface GoalSettingWizardProps {
    onClose: () => void;
    onSave: (plan: StudyPlan) => void;
    initialExamId?: string;
}

export default function GoalSettingWizard({ onClose, onSave, initialExamId }: GoalSettingWizardProps) {
    const [estimatedMs, setEstimatedMs] = useState(5000);

    // Fetch estimate on mount
    useEffect(() => {
        fetch('/api/ai/plan/estimate')
            .then(res => res.json())
            .then(data => {
                if (data.estimatedMs) setEstimatedMs(data.estimatedMs);
            })
            .catch(err => console.error("Failed to fetch estimate", err));
    }, []);

    const [loading, setLoading] = useState(false);

    // Inputs
    const [targetExam, setTargetExam] = useState(initialExamId?.split('-')[0] || 'AP');
    const [hoursWeekday, setHoursWeekday] = useState(1);
    const [hoursWeekend, setHoursWeekend] = useState(3);
    const [examDate, setExamDate] = useState('');
    const [scores, setScores] = useState<Record<string, number>>({
        tech: 3,
        algo: 3,
        net_sec: 3,
        db_dev: 3,
        mgmt_strat: 3,
        reading: 3,
        habit: 3,
        retention: 3,
        motivation: 3,
        familiarity: 3
    });

    const EVALUATION_ITEMS = [
        { id: 'tech', label: 'テクノロジ系知識 (基礎理論・HW・SW)' },
        { id: 'algo', label: 'アルゴリズム・プログラミング能力' },
        { id: 'net_sec', label: 'ネットワーク・セキュリティ知識' },
        { id: 'db_dev', label: 'データベース・システム開発' },
        { id: 'mgmt_strat', label: 'マネジメント・ストラテジ系知識' },
        { id: 'reading', label: '長文読解力 (午後試験対策)' },
        { id: 'habit', label: '現在の学習習慣・継続力' },
        { id: 'retention', label: '基礎知識の定着度' },
        { id: 'motivation', label: '試験へのモチベーション' },
        { id: 'familiarity', label: 'IPA試験形式への慣れ' },
    ];

    const handleGenerate = async () => {
        if (!examDate) {
            alert("受験日を入力してください。");
            return;
        }
        setLoading(true);
        // Progress bar will start animating automatically via CSS or logic below
        try {
            const res = await fetch('/api/ai/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: "guest",
                    targetExam,
                    studyTimeWeekday: hoursWeekday,
                    studyTimeWeekend: hoursWeekend,
                    examDate: examDate,
                    scores
                })
            });

            if (!res.ok) throw new Error("Failed");

            const rawPlan = await res.json();
            const plan: StudyPlan = {
                ...rawPlan,
                id: crypto.randomUUID(), // Generate client-side ID
                targetExam: targetExam // Save the target exam code
            };
            onSave(plan);

        } catch (e) {
            console.error(e);
            alert("計画の生成に失敗しました。もう一度お試しください。");
            setLoading(false);
        }
    };

    const handleScoreChange = (id: string, val: number) => {
        setScores(prev => ({ ...prev, [id]: val }));
    };

    const totalHoursWeek = (hoursWeekday * 5) + (hoursWeekend * 2);

    return (
        <div className={styles.overlay} onClick={(e) => {
            // Close if clicked on overlay (outside modal)
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <header className={styles.modalHeader}>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">×</button>
                    <h2 className={styles.modalTitle}>AI学習プランナー</h2>
                    <p className={styles.modalSubtitle}>あなたの目標に合わせて、最適な学習計画を提案します。</p>
                </header>

                {
                    loading ? (
                        <div className={styles.stepContainer} style={{ textAlign: 'center', padding: '3rem 0' }}>
                            <div style={{ marginBottom: '2rem' }}>
                                <div style={{
                                    width: '100%',
                                    height: '24px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        width: '95%', // Target width (almost full but leaves room for final processing)
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--primary-color), #3b82f6)',
                                        borderRadius: '12px',
                                        transition: `width ${estimatedMs}ms linear` // Predictable animation
                                    }} />
                                    {/* Add a shimmer effect */}
                                    <div className={styles.shimmer} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <span>Generating...</span>
                                    <span>目安: 約{Math.ceil(estimatedMs / 1000)}秒</span>
                                </div>
                            </div>

                            <h3 style={{ marginBottom: '0.5rem' }}>AIが計画を最適化中...</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                過去の実績データに基づき、処理時間を予測しています。<br />
                                合格までの最短ルートを設計中です。
                            </p>

                            <style jsx>{`
                            .${styles.shimmer} {
                                position: absolute;
                                top: 0; left: 0;
                                width: 100%; height: 100%;
                                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                                transform: translateX(-100%);
                                animation: shimmer 2s infinite;
                            }
                            @keyframes shimmer {
                                100% { transform: translateX(100%); }
                            }
                        `}</style>
                        </div>
                    ) : (
                        <div className={styles.stepContainer}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>目標の試験区分</label>
                                <select
                                    className={styles.select}
                                    value={targetExam}
                                    onChange={(e) => setTargetExam(e.target.value)}
                                >
                                    {['IP', 'FE', 'AP', 'SC', 'PM', 'NW', 'SA', 'ST'].map(exam => (
                                        <option key={exam} value={exam}>{exam}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.label}>受験予定日</label>
                                <input
                                    type="date"
                                    required
                                    min={new Date().toISOString().split('T')[0]}
                                    value={examDate}
                                    onChange={(e) => setExamDate(e.target.value)}
                                    // Force picker on click
                                    onClick={(e) => {
                                        try {
                                            (e.target as HTMLInputElement).showPicker();
                                        } catch (err) {
                                            // Fallback for browsers that don't support showPicker
                                        }
                                    }}
                                    className={styles.input}
                                    style={{ cursor: 'pointer' }}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.label}>学習時間の確保（1日あたり）</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>平日 (月~金)</div>
                                        <input
                                            type="range"
                                            min="0" max="6" step="0.5"
                                            value={hoursWeekday}
                                            onChange={(e) => setHoursWeekday(Number(e.target.value))}
                                            className={styles.input}
                                        />
                                        <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{hoursWeekday} 時間</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>休日 (土日)</div>
                                        <input
                                            type="range"
                                            min="0" max="12" step="0.5"
                                            value={hoursWeekend}
                                            onChange={(e) => setHoursWeekend(Number(e.target.value))}
                                            className={styles.input}
                                        />
                                        <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{hoursWeekend} 時間</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                        <span style={{ fontWeight: 'bold' }}>💡 一般的な学習時間の目安:</span><br />
                                        {(() => {
                                            const RECOMMENDED_HOURS: Record<string, string> = {
                                                'IP': '約100時間',
                                                'FE': '約200時間',
                                                'AP': '約500時間',
                                                'SC': '約500時間〜',
                                                'PM': '約500時間〜',
                                                'NW': '約500時間〜',
                                                'SA': '約500時間〜',
                                                'ST': '約500時間〜',
                                            };
                                            return RECOMMENDED_HOURS[targetExam] || '不明';
                                        })()}
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        現在の設定: 約 {totalHoursWeek} 時間 / 週
                                    </div>
                                </div>

                                {/* Feasibility Visualization */}
                                {examDate && (
                                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        {(() => {
                                            const today = new Date();
                                            const examDateObj = new Date(examDate);
                                            const diffTime = Math.max(0, examDateObj.getTime() - today.getTime());
                                            const daysUntilExam = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                            const weeksUntilExam = daysUntilExam / 7;
                                            const projectedTotalHours = Math.round(totalHoursWeek * weeksUntilExam);

                                            const RECOMMENDED_HOURS_NUM: Record<string, number> = {
                                                'IP': 100, 'FE': 200, 'AP': 500, 'SC': 500, 'PM': 500, 'NW': 500, 'SA': 500, 'ST': 500
                                            };
                                            const recommended = RECOMMENDED_HOURS_NUM[targetExam] || 500;
                                            const progressPercent = Math.min(100, (projectedTotalHours / recommended) * 100);

                                            // Determine color based on progress
                                            let progressBarColor = '#ef4444'; // red
                                            if (progressPercent >= 100) progressBarColor = '#10b981'; // green
                                            else if (progressPercent >= 80) progressBarColor = '#f59e0b'; // yellow/orange

                                            return (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                                        <span>
                                                            予測総学習時間: <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{projectedTotalHours}</strong> 時間
                                                        </span>
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                            試験まであと {daysUntilExam} 日
                                                        </span>
                                                    </div>

                                                    {/* Progress Bar Container */}
                                                    <div style={{ position: 'relative', height: '18px', background: 'var(--border-color)', borderRadius: '9px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                                        {/* Goal Marker (if progress < 100, the bar represents progress towards goal, so full bar is goal) */}
                                                        <div style={{
                                                            width: `${progressPercent}%`,
                                                            height: '100%',
                                                            background: progressBarColor,
                                                            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                                        }} />

                                                        <div style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            right: '10px',
                                                            height: '100%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            fontSize: '0.75rem',
                                                            color: 'var(--text-secondary)',
                                                            textShadow: '0 0 2px rgba(255,255,255,0.8)'
                                                        }}>
                                                            目標: {recommended}h
                                                        </div>
                                                    </div>

                                                    <div style={{ fontSize: '0.85rem', color: progressPercent >= 100 ? 'var(--success-text)' : 'var(--text-secondary)' }}>
                                                        {progressPercent >= 100
                                                            ? '✨ 十分な学習時間を確保できそうです！この調子で頑張りましょう。'
                                                            : `⚠️ 目標まであと ${recommended - projectedTotalHours} 時間不足しています。学習時間を増やすか、効率化を検討してください。`
                                                        }
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.label}>自己評価 (1: 自信なし ~ 5: 自信あり)</label>
                                <div className={styles.assessmentGrid}>
                                    {EVALUATION_ITEMS.map((item) => (
                                        <div key={item.id} className={styles.assessmentItem}>
                                            <span className={styles.assessmentLabel}>{item.label}</span>
                                            <div className={styles.rangeContainer}>
                                                <input
                                                    type="range"
                                                    min="1" max="5"
                                                    value={scores[item.id]}
                                                    onChange={(e) => handleScoreChange(item.id, Number(e.target.value))}
                                                    className={styles.rangeInput}
                                                />
                                                <span className={styles.scoreValue}>{scores[item.id]}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.actions}>
                                <button onClick={onClose} className={`${styles.btn} ${styles.btnSecondary}`}>キャンセル</button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className={`${styles.btn} ${styles.btnPrimary}`}
                                >
                                    計画を作成する
                                </button>
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
}
