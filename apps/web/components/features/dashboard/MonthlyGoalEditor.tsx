/**
 * MonthlyGoalEditor - 月次定量目標の編集モーダル
 *
 * ユーザーが定量的な中期目標を設定・編集できるUI
 */
'use client';

import { useState } from 'react';
import { MonthlyGoal } from './GoalSettingWizard';
import styles from './MonthlyGoalEditor.module.css';

interface MonthlyGoalEditorProps {
    goals: MonthlyGoal[];
    monthlyGoalText: string;
    onSave: (goals: MonthlyGoal[], goalText: string) => void;
    onClose: () => void;
}

const GOAL_TYPE_OPTIONS: { type: MonthlyGoal['type']; label: string; unit: string; emoji: string; defaultTarget: number }[] = [
    { type: 'questionCount', label: '問題演習数', unit: '問', emoji: '📝', defaultTarget: 200 },
    { type: 'accuracy', label: '正答率', unit: '%', emoji: '🎯', defaultTarget: 70 },
    { type: 'studyDays', label: '学習日数', unit: '日', emoji: '📅', defaultTarget: 20 },
    { type: 'correctCount', label: '正解数', unit: '問', emoji: '✅', defaultTarget: 140 },
];

export default function MonthlyGoalEditor({ goals, monthlyGoalText, onSave, onClose }: MonthlyGoalEditorProps) {
    const [editGoals, setEditGoals] = useState<MonthlyGoal[]>(
        goals.length > 0 ? goals.map(g => ({ ...g })) : getDefaults()
    );
    const [goalText, setGoalText] = useState(monthlyGoalText);

    function getDefaults(): MonthlyGoal[] {
        return GOAL_TYPE_OPTIONS.map(opt => ({
            id: `monthly-${opt.type}`,
            label: opt.label,
            type: opt.type,
            targetValue: opt.defaultTarget,
            unit: opt.unit,
            iconEmoji: opt.emoji,
        }));
    }

    const updateGoal = (index: number, field: keyof MonthlyGoal, value: any) => {
        setEditGoals(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const removeGoal = (index: number) => {
        setEditGoals(prev => prev.filter((_, i) => i !== index));
    };

    const addGoal = () => {
        // 使われていないタイプを探す
        const usedTypes = new Set(editGoals.map(g => g.type));
        const available = GOAL_TYPE_OPTIONS.find(opt => !usedTypes.has(opt.type));
        if (available) {
            setEditGoals(prev => [
                ...prev,
                {
                    id: `monthly-${available.type}-${Date.now()}`,
                    label: available.label,
                    type: available.type,
                    targetValue: available.defaultTarget,
                    unit: available.unit,
                    iconEmoji: available.emoji,
                },
            ]);
        }
    };

    const handleSave = () => {
        // 目標値が0以下のものは除外
        const validGoals = editGoals.filter(g => g.targetValue > 0);
        onSave(validGoals, goalText);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3>📊 今月の定量目標を設定</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                {/* テキスト目標 */}
                <div className={styles.section}>
                    <label className={styles.label}>今月の目標（テキスト）</label>
                    <input
                        type="text"
                        className={styles.textInput}
                        value={goalText}
                        onChange={e => setGoalText(e.target.value)}
                        placeholder="例: 午前試験対策を仕上げる"
                    />
                </div>

                {/* 定量目標リスト */}
                <div className={styles.section}>
                    <label className={styles.label}>定量目標</label>
                    <div className={styles.goalList}>
                        {editGoals.map((goal, idx) => (
                            <div key={goal.id} className={styles.goalRow}>
                                <span className={styles.goalEmoji}>{goal.iconEmoji}</span>
                                <div className={styles.goalInfo}>
                                    <select
                                        className={styles.typeSelect}
                                        value={goal.type}
                                        onChange={e => {
                                            const opt = GOAL_TYPE_OPTIONS.find(o => o.type === e.target.value);
                                            if (opt) {
                                                updateGoal(idx, 'type', opt.type);
                                                updateGoal(idx, 'label', opt.label);
                                                updateGoal(idx, 'unit', opt.unit);
                                                updateGoal(idx, 'iconEmoji', opt.emoji);
                                            }
                                        }}
                                    >
                                        {GOAL_TYPE_OPTIONS.map(opt => (
                                            <option key={opt.type} value={opt.type}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.goalTarget}>
                                    <input
                                        type="number"
                                        className={styles.numberInput}
                                        value={goal.targetValue}
                                        min={1}
                                        max={goal.type === 'accuracy' ? 100 : 9999}
                                        onChange={e => updateGoal(idx, 'targetValue', parseInt(e.target.value) || 0)}
                                    />
                                    <span className={styles.goalUnit}>{goal.unit}</span>
                                </div>
                                <button type="button" className={styles.removeBtn} onClick={() => removeGoal(idx)}>🗑</button>
                            </div>
                        ))}
                    </div>

                    {editGoals.length < GOAL_TYPE_OPTIONS.length && (
                        <button type="button" className={styles.addBtn} onClick={addGoal}>
                            + 目標を追加
                        </button>
                    )}
                </div>

                <div className={styles.footer}>
                    <button type="button" className={styles.cancelBtn} onClick={onClose}>キャンセル</button>
                    <button type="button" className={styles.saveBtn} onClick={handleSave}>保存</button>
                </div>
            </div>
        </div>
    );
}
