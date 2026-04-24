'use client';

import { useMemo, useState } from 'react';

import type { PerformanceProfile } from '@/lib/types/performanceProfile';

import styles from './PerformanceInsights.module.css';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const WEAKNESS_THRESHOLD = 0.6;
const PACE_RATIO_HOT = 1.15;
const PACE_RATIO_COLD = 0.85;

interface PerformanceInsightsProps {
    enabled?: boolean;
    /**
     * profile / loading / error は親 (DashboardClient) で `usePerformanceProfile` を
     * 1 回だけ呼び出し、その結果を子コンポーネントとヘルスチェックフックに共有する。
     * これにより同一 API (`/api/profile/performance`) の二重呼び出しを回避する (#228 PR レビュー対応)。
     */
    profile: PerformanceProfile | null;
    loading: boolean;
    error: string | null;
    onRetry?: () => void;
}

interface PaceMood {
    label: string;
    badge: string;
}

function describePace(ratio: number): PaceMood {
    if (ratio >= PACE_RATIO_HOT) return { label: 'ノッてきた', badge: '🔥' };
    if (ratio <= PACE_RATIO_COLD) return { label: '失速気味', badge: '😴' };
    return { label: '安定', badge: '🙂' };
}

function describeContinuity(consecutiveDays: number): string {
    if (consecutiveDays <= 0) return 'まずは1日始めましょう';
    if (consecutiveDays === 1) return '今日からスタート 🌱';
    if (consecutiveDays < 7) return `${consecutiveDays}日連続学習中 🔥`;
    if (consecutiveDays < 30) return `${consecutiveDays}日連続！素晴らしい 🚀`;
    return `${consecutiveDays}日連続！レジェンド級 🏆`;
}

function formatPercent(rate: number): string {
    return `${Math.round(rate * 100)}%`;
}

/**
 * 「あなたの学習ペース」可視化UI (#219)
 *
 * PerformanceProfile を可視化:
 * - 連続学習日数 / ペース比 γ / 直近7日達成率
 * - 曜日別ペース棒グラフ (今日強調)
 * - カテゴリ別正答率 (60%未満は弱点として赤強調)
 */
export default function PerformanceInsights({
    enabled = true,
    profile,
    loading,
    error,
    onRetry,
}: PerformanceInsightsProps) {
    const [collapsed, setCollapsed] = useState(false);

    const todayWeekday = useMemo(() => new Date().getDay(), []);
    const sortedCategories = useMemo(() => {
        if (!profile) return [];
        return Object.entries(profile.accuracyByCategory)
            .filter(([, v]) => v.total > 0)
            .sort((a, b) => a[1].rate - b[1].rate);
    }, [profile]);

    const maxPace = useMemo(() => {
        if (!profile) return 0;
        return Math.max(1, ...profile.paceByWeekday);
    }, [profile]);

    if (!enabled) return null;
    if (loading && !profile) {
        return (
            <section className={styles.card} aria-busy="true">
                <div className={styles.empty}>📊 学習ペースを集計中...</div>
            </section>
        );
    }
    if (error && !profile) {
        return (
            <section className={styles.card} role="alert">
                <div className={styles.empty}>
                    ⚠️ 学習ペースの取得に失敗しました ({error})
                    {onRetry && (
                        <>
                            <br />
                            <button type="button" className={styles.collapseBtn} onClick={onRetry}>
                                再試行
                            </button>
                        </>
                    )}
                </div>
            </section>
        );
    }
    if (!profile) {
        return (
            <section className={styles.card}>
                <div className={styles.empty}>
                    📊 まだ学習データが少ないため、ペースを表示できません。
                    <br />
                    数日学習すると、ここにあなたの傾向が見えてきます。
                </div>
            </section>
        );
    }

    const pace = describePace(profile.paceRatio);
    const continuityMsg = describeContinuity(profile.consecutiveStudyDays);
    const hasAnyPace = profile.paceByWeekday.some((p) => p > 0);
    const hasAnyCategory = sortedCategories.length > 0;

    return (
        <section className={styles.card} aria-label="あなたの学習ペース">
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>📊 あなたの学習ペース</h2>
                    <p className={styles.subtitle}>{continuityMsg}</p>
                </div>
                <button
                    type="button"
                    className={styles.collapseBtn}
                    onClick={() => setCollapsed((v) => !v)}
                    aria-expanded={!collapsed}
                >
                    {collapsed ? '展開' : '折りたたむ'}
                </button>
            </div>

            {!collapsed && (
                <>
                    <div className={styles.metrics}>
                        <div className={styles.metric}>
                            <div className={styles.metricLabel}>ペース比 (直近 vs 1週前)</div>
                            <div className={styles.metricValue}>×{profile.paceRatio.toFixed(2)}</div>
                            <span className={styles.metricBadge}>
                                {pace.badge} {pace.label}
                            </span>
                        </div>
                        <div className={styles.metric}>
                            <div className={styles.metricLabel}>直近7日 達成率</div>
                            <div className={styles.metricValue}>{formatPercent(profile.recentAchievementRate)}</div>
                            {profile.consecutiveOnFireDays >= 3 && (
                                <span className={styles.metricBadge}>🚀 絶好調 {profile.consecutiveOnFireDays}日連続</span>
                            )}
                        </div>
                        <div className={styles.metric}>
                            <div className={styles.metricLabel}>学習継続率 (28日)</div>
                            <div className={styles.metricValue}>{formatPercent(profile.continuityRate)}</div>
                        </div>
                    </div>

                    {hasAnyPace && (
                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>曜日別ペース (問/日)</h3>
                            <div className={styles.weekdayChart} role="img" aria-label="曜日別の平均解答数">
                                {profile.paceByWeekday.map((p, i) => {
                                    const heightPct = maxPace > 0 ? (p / maxPace) * 100 : 0;
                                    const isToday = i === todayWeekday;
                                    return (
                                        <div key={i} className={styles.weekdayBarWrap}>
                                            <div
                                                className={`${styles.weekdayBar} ${isToday ? styles.weekdayBarToday : ''}`}
                                                style={{ height: `${heightPct}%` }}
                                                title={`${WEEKDAY_LABELS[i]}: ${p.toFixed(1)}問/日`}
                                            />
                                            <span className={styles.weekdayLabel}>{WEEKDAY_LABELS[i]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {hasAnyCategory && (
                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>カテゴリ別正答率 (弱い順)</h3>
                            <div className={styles.categories}>
                                {sortedCategories.slice(0, 6).map(([category, acc]) => {
                                    const isWeak = acc.rate < WEAKNESS_THRESHOLD;
                                    return (
                                        <div key={category} className={styles.categoryRow}>
                                            <span className={styles.categoryName} title={category}>
                                                {category}
                                            </span>
                                            <div className={styles.categoryBarTrack}>
                                                <div
                                                    className={`${styles.categoryBarFill} ${isWeak ? styles.categoryBarFillWeak : ''}`}
                                                    style={{ width: `${Math.round(acc.rate * 100)}%` }}
                                                />
                                            </div>
                                            <span className={styles.categoryRate}>
                                                {formatPercent(acc.rate)}
                                                {isWeak ? ' ⚠️' : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
