'use client';

import { useEffect, useState } from 'react';

import styles from './PlanHealthToast.module.css';
import type { PlanHealthResult } from '@/lib/types/planHealth';

interface PlanHealthToastProps {
    health: PlanHealthResult;
    onAction: () => void;
    onLater: () => void;
    onClose: () => void;
    /** 自動消去までの ms。default 12000 (12 秒) */
    autoDismissMs?: number;
}

const STATUS_EMOJI: Record<PlanHealthResult['status'], string> = {
    on_track: '🟢',
    slight_delay: '🟡',
    major_delay: '🔴',
    on_fire: '🚀',
};

const ACTION_LABEL: Record<NonNullable<PlanHealthResult['suggestion']['action']>, string> = {
    open_replan: '計画を見直す',
    increase_pace: 'ペースを上げる',
};

/**
 * 計画ヘルス提案トースト (#221).
 * - 右下スライドイン
 * - 自動消去 (default 12s) — 操作ボタンクリック時はキャンセル
 * - aria-live=polite でスクリーンリーダ対応
 */
export default function PlanHealthToast({
    health,
    onAction,
    onLater,
    onClose,
    autoDismissMs = 12000,
}: PlanHealthToastProps) {
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (paused) return;
        const t = window.setTimeout(onClose, autoDismissMs);
        return () => window.clearTimeout(t);
    }, [paused, autoDismissMs, onClose]);

    const handleAction = () => {
        setPaused(true);
        onAction();
    };

    const actionLabel = health.suggestion.action ? ACTION_LABEL[health.suggestion.action] : null;
    const statusClass =
        health.status === 'on_fire'
            ? styles.statusFire
            : health.status === 'major_delay'
              ? styles.statusMajor
              : health.status === 'slight_delay'
                ? styles.statusSlight
                : styles.statusOk;

    return (
        <div
            className={`${styles.toast} ${statusClass}`}
            role="status"
            aria-live="polite"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(e) => {
                // フォーカスがトースト内の別要素に移っただけなら pause を維持
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setPaused(false);
            }}
        >
            <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="閉じる"
            >
                ×
            </button>
            <div className={styles.header}>
                <span className={styles.emoji} aria-hidden="true">
                    {STATUS_EMOJI[health.status]}
                </span>
                <strong className={styles.headline}>{health.suggestion.headline}</strong>
            </div>
            <p className={styles.body}>{health.suggestion.body}</p>
            {actionLabel && (
                <div className={styles.actions}>
                    <button type="button" className={styles.laterBtn} onClick={onLater}>
                        後で
                    </button>
                    <button type="button" className={styles.primaryBtn} onClick={handleAction}>
                        {actionLabel}
                    </button>
                </div>
            )}
        </div>
    );
}
