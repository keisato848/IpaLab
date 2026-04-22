'use client';

import { useState, useEffect } from 'react';
import styles from './GoalSettingWizard.module.css';
import { getExamTypeName } from '@/lib/exam-utils';
import type { StudyPlan, MonthlyGoal } from '@/lib/types/studyPlan';

export type { StudyPlan, MonthlyGoal };

interface GoalSettingWizardProps {
    onClose: () => void;
    onSave: (plan: StudyPlan) => void;
    onAsyncJobCreated?: (jobId: string) => void; // 非同期ジョブ作成時のコールバック
    initialExamId?: string;
}

export default function GoalSettingWizard({ onClose, onSave, onAsyncJobCreated, initialExamId }: GoalSettingWizardProps) {
    const [estimatedMs, setEstimatedMs] = useState(5000);
    const [currentStep, setCurrentStep] = useState(1);

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

    const [pollingStatus, setPollingStatus] = useState<string>('');
    const [retryCount, setRetryCount] = useState(0);
    const [asyncJobCreated, setAsyncJobCreated] = useState(false);

    /**
     * 計画名を自動生成する
     * フォーマット: {試験名} {受験日} {X}h/週
     */
    const generatePlanTitle = (examCode: string, date: string, weekdayHours: number, weekendHours: number): string => {
        const examName = getExamTypeName(examCode);
        const weeklyHours = Math.round(weekdayHours * 5 + weekendHours * 2);
        return `${examName} ${date} ${weeklyHours}h/週`;
    };

    // 非同期ジョブを作成（タイムアウト時のフォールバック）
    const createAsyncJob = async (): Promise<boolean> => {
        try {
            setPollingStatus('バックグラウンドで処理を続行します...');
            const res = await fetch('/api/ai/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetExam,
                    studyTimeWeekday: hoursWeekday,
                    studyTimeWeekend: hoursWeekend,
                    examDate: examDate,
                    scores
                }),
            });

            if (res.ok) {
                const job = await res.json();
                setAsyncJobCreated(true);
                onAsyncJobCreated?.(job.id);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Failed to create async job:', e);
            return false;
        }
    };

    const handleGenerate = async () => {
        if (!examDate) {
            alert("受験日を入力してください。");
            return;
        }
        setLoading(true);
        setPollingStatus('AI計画を生成中...');
        setRetryCount(0);
        setAsyncJobCreated(false);

        // 同期処理: 60秒タイムアウトで1回試行（Consumption Planコールドスタート+Gemini API応答を考慮）
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

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
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${res.status}`);
            }

            const rawPlan = await res.json();
            const plan: StudyPlan = {
                ...rawPlan,
                id: crypto.randomUUID(),
                targetExam: targetExam,
                title: generatePlanTitle(targetExam, examDate, hoursWeekday, hoursWeekend),
                hoursWeekday: hoursWeekday,
                hoursWeekend: hoursWeekend
            };
            onSave(plan);
            return; // 成功したらここで終了

        } catch (e: any) {
            console.error('Sync plan generation failed:', e);
            
            // タイムアウトまたはエラーの場合、非同期ジョブを作成
            if (e.name === 'AbortError' || e.message?.includes('timeout')) {
                setPollingStatus('タイムアウト - バックグラウンド処理に切り替えます...');
                
                const jobCreated = await createAsyncJob();
                if (jobCreated) {
                    setLoading(false);
                    // 成功メッセージを表示してウィザードを閉じる
                    return;
                }
            }
            
            // 非同期ジョブも作成できなかった場合
            alert(`計画の生成に失敗しました: ${e.message || 'もう一度お試しください。'}\n\nサーバーが混雑している可能性があります。しばらく待ってから再度お試しください。`);
            setLoading(false);
            setPollingStatus('');
        }
    };

    const handleScoreChange = (id: string, val: number) => {
        setScores(prev => ({ ...prev, [id]: val }));
    };

    const totalHoursWeek = (hoursWeekday * 5) + (hoursWeekend * 2);

    const RECOMMENDED_HOURS: Record<string, string> = {
        'IP': '約100時間', 'FE': '約200時間', 'AP': '約500時間',
        'SC': '約500時間〜', 'PM': '約500時間〜', 'NW': '約500時間〜',
        'SA': '約500時間〜', 'ST': '約500時間〜',
    };

    const RECOMMENDED_HOURS_NUM: Record<string, number> = {
        'IP': 100, 'FE': 200, 'AP': 500, 'SC': 500, 'PM': 500, 'NW': 500, 'SA': 500, 'ST': 500
    };

    // Calculate feasibility
    const getFeasibility = () => {
        if (!examDate) return null;
        const today = new Date();
        const examDateObj = new Date(examDate);
        const diffTime = Math.max(0, examDateObj.getTime() - today.getTime());
        const daysUntilExam = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weeksUntilExam = daysUntilExam / 7;
        const projectedTotalHours = Math.round(totalHoursWeek * weeksUntilExam);
        const recommended = RECOMMENDED_HOURS_NUM[targetExam] || 500;
        const progressPercent = Math.min(100, (projectedTotalHours / recommended) * 100);
        return { daysUntilExam, projectedTotalHours, recommended, progressPercent };
    };

    // Step validation
    const canProceedToStep2 = targetExam && examDate;
    const canProceedToStep3 = canProceedToStep2 && (hoursWeekday > 0 || hoursWeekend > 0);

    const goToStep = (step: number) => {
        setCurrentStep(step);
    };

    const renderStepIndicator = () => (
        <div className={styles.stepIndicator}>
            {[1, 2, 3].map((step) => (
                <div
                    key={step}
                    className={`${styles.stepDot} ${currentStep === step ? styles.stepDotActive : ''} ${currentStep > step ? styles.stepDotCompleted : ''}`}
                    onClick={() => {
                        if (step === 1) goToStep(1);
                        else if (step === 2 && canProceedToStep2) goToStep(2);
                        else if (step === 3 && canProceedToStep3) goToStep(3);
                    }}
                >
                    {currentStep > step ? '✓' : step}
                </div>
            ))}
        </div>
    );

    const renderStep1 = () => (
        <div className={styles.stepContent}>
            <h3 className={styles.stepTitle}>Step 1: 目標設定</h3>

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
                <div className={styles.hint}>
                    💡 {targetExam}の目安学習時間: {RECOMMENDED_HOURS[targetExam]}
                </div>
            </div>

            <div className={styles.inputGroup}>
                <label className={styles.label}>受験予定日</label>
                <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    onClick={(e) => {
                        try {
                            (e.target as HTMLInputElement).showPicker();
                        } catch (err) { }
                    }}
                    className={styles.input}
                    style={{ cursor: 'pointer' }}
                />
            </div>

            <div className={styles.stepActions}>
                <button onClick={onClose} className={`${styles.btn} ${styles.btnSecondary}`}>キャンセル</button>
                <button
                    onClick={() => goToStep(2)}
                    disabled={!canProceedToStep2}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                >
                    次へ →
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => {
        const feasibility = getFeasibility();
        return (
            <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Step 2: 学習時間</h3>

                <div className={styles.inputGroup}>
                    <label className={styles.label}>1日あたりの学習時間</label>
                    <div className={styles.timeGrid}>
                        <div className={styles.timeItem}>
                            <div className={styles.timeLabel}>平日 (月~金)</div>
                            <input
                                type="range"
                                min="0" max="6" step="0.5"
                                value={hoursWeekday}
                                onChange={(e) => setHoursWeekday(Number(e.target.value))}
                                className={styles.rangeInput}
                            />
                            <div className={styles.timeValue}>{hoursWeekday} 時間</div>
                        </div>
                        <div className={styles.timeItem}>
                            <div className={styles.timeLabel}>休日 (土日)</div>
                            <input
                                type="range"
                                min="0" max="12" step="0.5"
                                value={hoursWeekend}
                                onChange={(e) => setHoursWeekend(Number(e.target.value))}
                                className={styles.rangeInput}
                            />
                            <div className={styles.timeValue}>{hoursWeekend} 時間</div>
                        </div>
                    </div>
                    <div className={styles.weeklyTotal}>
                        週あたり: 約 {totalHoursWeek} 時間
                    </div>
                </div>

                {feasibility && (
                    <div className={styles.feasibilityBox}>
                        <div className={styles.feasibilityHeader}>
                            <span>予測総学習時間: <strong>{feasibility.projectedTotalHours}h</strong></span>
                            <span>試験まで {feasibility.daysUntilExam} 日</span>
                        </div>
                        <div className={styles.progressBar}>
                            <div
                                className={styles.progressFill}
                                style={{
                                    width: `${feasibility.progressPercent}%`,
                                    background: feasibility.progressPercent >= 100 ? '#10b981' :
                                        feasibility.progressPercent >= 80 ? '#f59e0b' : '#ef4444'
                                }}
                            />
                            <span className={styles.progressGoal}>目標: {feasibility.recommended}h</span>
                        </div>
                        <div className={styles.feasibilityMessage} style={{
                            color: feasibility.progressPercent >= 100 ? 'var(--success-text)' : 'var(--warning-text)'
                        }}>
                            {feasibility.progressPercent >= 100
                                ? '✨ 十分な学習時間を確保できそうです！'
                                : `⚠️ 目標まであと ${feasibility.recommended - feasibility.projectedTotalHours} 時間不足`
                            }
                        </div>
                    </div>
                )}

                <div className={styles.stepActions}>
                    <button onClick={() => goToStep(1)} className={`${styles.btn} ${styles.btnSecondary}`}>← 戻る</button>
                    <button
                        onClick={() => goToStep(3)}
                        disabled={!canProceedToStep3}
                        className={`${styles.btn} ${styles.btnPrimary}`}
                    >
                        次へ →
                    </button>
                </div>
            </div>
        );
    };

    const renderStep3 = () => (
        <div className={styles.stepContent}>
            <h3 className={styles.stepTitle}>Step 3: 自己評価</h3>
            <p className={styles.stepDescription}>各項目について自信度を評価してください (1: 自信なし ~ 5: 自信あり)</p>

            <div className={styles.assessmentList}>
                {EVALUATION_ITEMS.map((item) => (
                    <div key={item.id} className={styles.assessmentRow}>
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

            <div className={styles.stepActions}>
                <button onClick={() => goToStep(2)} className={`${styles.btn} ${styles.btnSecondary}`}>← 戻る</button>
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnGenerate}`}
                >
                    🚀 計画を作成する
                </button>
            </div>
        </div>
    );

    const renderLoading = () => (
        <div className={styles.loadingContainer}>
            <div className={styles.loadingProgress}>
                <div className={styles.loadingBar} style={{ animationDuration: `${estimatedMs}ms` }} />
                <div className={styles.shimmer} />
            </div>
            <div className={styles.loadingInfo}>
                <span>{pollingStatus || 'AI計画を生成中...'}</span>
                {retryCount > 0 && <span>再試行 {retryCount}/3</span>}
            </div>
            <h3 className={styles.loadingTitle}>AIが計画を最適化中...</h3>
            <p className={styles.loadingDescription}>
                過去の実績データに基づき、合格までの最短ルートを設計中です。
                {retryCount > 0 && <><br />接続に問題がありましたが、自動的にリトライしています。</>}
            </p>
            <p className={styles.loadingHint}>
                💡 処理には30秒〜1分程度かかる場合があります
            </p>
        </div>
    );

    // 非同期ジョブ作成完了時のUI
    const renderAsyncJobCreated = () => (
        <div className={styles.loadingContainer}>
            <div className={styles.asyncJobCreated}>
                <div className={styles.asyncJobIcon}>📋</div>
                <h3 className={styles.loadingTitle}>バックグラウンドで処理中</h3>
                <p className={styles.loadingDescription}>
                    計画の生成をバックグラウンドで続行しています。<br />
                    完了次第、ダッシュボードで通知されます。
                </p>
                <p className={styles.loadingHint}>
                    💡 このウィンドウを閉じても、計画の生成は継続されます
                </p>
                <button
                    onClick={onClose}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    style={{ marginTop: '1.5rem' }}
                >
                    閉じる
                </button>
            </div>
        </div>
    );

    return (
        <div className={styles.overlay} onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <header className={styles.modalHeader}>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">×</button>
                    <h2 className={styles.modalTitle}>AI学習プランナー</h2>
                    {!loading && !asyncJobCreated && renderStepIndicator()}
                </header>

                {asyncJobCreated ? renderAsyncJobCreated() : loading ? renderLoading() : (
                    <>
                        {currentStep === 1 && renderStep1()}
                        {currentStep === 2 && renderStep2()}
                        {currentStep === 3 && renderStep3()}
                    </>
                )}
            </div>
        </div>
    );
}
