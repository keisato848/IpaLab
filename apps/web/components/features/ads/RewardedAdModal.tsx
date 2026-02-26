'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { RewardedAdState } from './types';
import styles from './RewardedAdModal.module.css';

/** リワード広告の表示秒数（秒） */
const AD_DURATION_SECONDS = 5;

interface RewardedAdModalProps {
    /** モーダルの表示/非表示 */
    isOpen: boolean;
    /** 広告視聴完了時のコールバック */
    onComplete: () => void;
    /** スキップ時のコールバック（認証ユーザー用） */
    onSkip: () => void;
    /** スキップ可能かどうか（認証ユーザーの場合 true） */
    canSkip?: boolean;
}

/**
 * リワード広告モーダル
 * 
 * 試験開始前に表示されるインタースティシャル型の広告。
 * - カウントダウンタイマー付き
 * - 認証ユーザーはスキップ可能
 * - ゲストユーザーは視聴完了まで待つ必要がある
 * - Google AdSense 広告スロットを表示（NEXT_PUBLIC_ADS_ENABLED=true の場合）
 * - フィーチャーフラグ OFF の場合はプレースホルダーを表示
 */
export default function RewardedAdModal({
    isOpen,
    onComplete,
    onSkip,
    canSkip = false,
}: RewardedAdModalProps) {
    const [state, setState] = useState<RewardedAdState>('idle');
    const [countdown, setCountdown] = useState(AD_DURATION_SECONDS);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // モーダルが開いたらカウントダウンを開始
    useEffect(() => {
        if (!isOpen) {
            // リセット
            setState('idle');
            setCountdown(AD_DURATION_SECONDS);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        setState('showing');
        setCountdown(AD_DURATION_SECONDS);

        timerRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                    }
                    setState('completed');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isOpen]);

    // ESC キーでスキップ（スキップ可能な場合のみ）
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && canSkip) {
                onSkip();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, canSkip, onSkip]);

    // オーバーレイクリックでスキップ（スキップ可能な場合のみ）
    const handleOverlayClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === overlayRef.current && canSkip) {
                onSkip();
            }
        },
        [canSkip, onSkip]
    );

    const handleComplete = useCallback(() => {
        setState('completed');
        onComplete();
    }, [onComplete]);

    const handleSkip = useCallback(() => {
        setState('skipped');
        onSkip();
    }, [onSkip]);

    if (!isOpen) return null;

    return (
        <div
            ref={overlayRef}
            className={styles.overlay}
            onClick={handleOverlayClick}
            role="dialog"
            aria-modal="true"
            aria-label="広告"
        >
            <div className={styles.modal}>
                {/* ヘッダー */}
                <div className={styles.header}>
                    <span className={styles.adLabel}>広告</span>
                    {canSkip && (
                        <button
                            className={styles.skipBtn}
                            onClick={handleSkip}
                            aria-label="広告をスキップ"
                        >
                            スキップ ✕
                        </button>
                    )}
                </div>

                {/* 広告コンテンツエリア */}
                <div className={styles.adContent}>
                    {process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ? (
                        <ins
                            className="adsbygoogle"
                            style={{ display: 'block', width: '100%', minHeight: '250px' }}
                            data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
                            data-ad-slot={process.env.NEXT_PUBLIC_ADSENSE_REWARDED_SLOT_ID}
                            data-ad-format="auto"
                            data-full-width-responsive="true"
                        />
                    ) : (
                        /* AdSense 未設定時のプレースホルダー */
                        <div className={styles.placeholder}>
                            <div className={styles.placeholderIcon}>📚</div>
                            <p className={styles.placeholderText}>
                                学習を応援しています！
                            </p>
                            <p className={styles.placeholderSub}>
                                この広告枠は今後、学習に役立つ情報をお届けします
                            </p>
                        </div>
                    )}
                </div>

                {/* フッター: カウントダウン or 開始ボタン */}
                <div className={styles.footer}>
                    {state === 'completed' ? (
                        <button
                            className={styles.startBtn}
                            onClick={handleComplete}
                            autoFocus
                        >
                            🚀 試験を開始する
                        </button>
                    ) : (
                        <div className={styles.countdown}>
                            <div className={styles.countdownBar}>
                                <div
                                    className={styles.countdownProgress}
                                    style={{
                                        width: `${((AD_DURATION_SECONDS - countdown) / AD_DURATION_SECONDS) * 100}%`,
                                    }}
                                />
                            </div>
                            <span className={styles.countdownText}>
                                {countdown}秒後に開始できます
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
