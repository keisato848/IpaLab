'use client';

import { useState } from 'react';
import styles from './PlanReadyNotification.module.css';
import { StudyPlanJob } from '@/lib/api';

interface PlanReadyNotificationProps {
    job: StudyPlanJob;
    onApply: (plan: any) => void;
    onDismiss: () => void;
}

/**
 * バックグラウンドで生成された計画の完了通知モーダル
 */
export default function PlanReadyNotification({ job, onApply, onDismiss }: PlanReadyNotificationProps) {
    const [isApplying, setIsApplying] = useState(false);

    const handleApply = async () => {
        if (!job.resultData) return;
        
        setIsApplying(true);
        try {
            // 通知済みフラグを設定
            await fetch(`/api/ai/jobs/${job.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notifiedAt: new Date().toISOString() }),
            });
            
            onApply(job.resultData);
        } catch (e) {
            console.error('Failed to apply plan:', e);
        } finally {
            setIsApplying(false);
        }
    };

    const handleDismiss = async () => {
        try {
            // 破棄フラグを設定
            await fetch(`/api/ai/jobs/${job.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dismissed: true }),
            });
        } catch (e) {
            console.error('Failed to dismiss job:', e);
        }
        
        onDismiss();
    };

    // 生成完了からの経過時間を計算
    const getElapsedTime = () => {
        if (!job.completedAt) return '';
        const completed = new Date(job.completedAt);
        const now = new Date();
        const diffMs = now.getTime() - completed.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        
        if (diffMin < 1) return 'たった今';
        if (diffMin < 60) return `${diffMin}分前`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour}時間前`;
        const diffDay = Math.floor(diffHour / 24);
        return `${diffDay}日前`;
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.iconContainer}>
                    <span className={styles.icon}>🎉</span>
                </div>
                
                <h2 className={styles.title}>学習計画が完成しました！</h2>
                
                <p className={styles.description}>
                    バックグラウンドで生成していた
                    <strong>{job.targetExam}</strong>
                    の学習計画が完了しました。
                </p>
                
                {job.completedAt && (
                    <p className={styles.timestamp}>
                        生成完了: {getElapsedTime()}
                    </p>
                )}
                
                <div className={styles.actions}>
                    <button
                        onClick={handleDismiss}
                        className={`${styles.btn} ${styles.btnSecondary}`}
                    >
                        後で確認
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={isApplying || !job.resultData}
                        className={`${styles.btn} ${styles.btnPrimary}`}
                    >
                        {isApplying ? '適用中...' : '計画を適用する'}
                    </button>
                </div>
            </div>
        </div>
    );
}
