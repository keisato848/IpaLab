'use client';

import { MonthlyStatsResult, MonthlyTrend } from '@/hooks/useMonthlyStats';
import styles from './MonthlyProgressCard.module.css';

interface MonthlyProgressCardProps {
    stats: MonthlyStatsResult;
}

/** 前月比トレンドバッジ */
function TrendBadge({ value, unit, invert }: { value: number; unit?: string; invert?: boolean }) {
    if (value === 0) {
        return <span className={styles.trendFlat}>→ 0</span>;
    }

    // invert: 値が下がったほうが良い指標（平均解答時間など）
    const isPositive = invert ? value < 0 : value > 0;
    const className = isPositive ? styles.trendUp : styles.trendDown;
    const arrow = value > 0 ? '↑' : '↓';
    const absValue = Math.abs(value);

    return (
        <span className={className}>
            {arrow} {absValue}{unit || ''}
        </span>
    );
}

/** 正答率に応じたバーの色 */
function getAccuracyColor(accuracy: number): string {
    if (accuracy >= 80) return '#22c55e';
    if (accuracy >= 60) return '#f59e0b';
    return '#ef4444';
}

export default function MonthlyProgressCard({ stats }: MonthlyProgressCardProps) {
    const { monthLabel, current, previous, trend, remainingDays, monthProgressPercent } = stats;

    return (
        <div className={styles.card}>
            {/* ヘッダー */}
            <div className={styles.header}>
                <div className={styles.title}>
                    📈 今月の進捗
                    <span className={styles.monthLabel}>{monthLabel}</span>
                </div>
                <span className={styles.remaining}>
                    残り {remainingDays} 日
                </span>
            </div>

            {/* 月の経過バー */}
            <div className={styles.monthBar}>
                <div
                    className={styles.monthBarFill}
                    style={{ width: `${monthProgressPercent}%` }}
                />
            </div>

            {/* メトリクスグリッド */}
            <div className={styles.metricsGrid}>
                {/* 問題数 */}
                <div className={styles.metricItem}>
                    <div className={styles.metricHeader}>
                        <span className={styles.metricLabel}>📝 問題数</span>
                        <TrendBadge value={trend.questionCountDiff} unit="問" />
                    </div>
                    <div className={styles.metricValue}>
                        {current.questionCount}
                        <span className={styles.metricUnit}>問</span>
                    </div>
                </div>

                {/* 正答率 */}
                <div className={styles.metricItem}>
                    <div className={styles.metricHeader}>
                        <span className={styles.metricLabel}>🎯 正答率</span>
                        <TrendBadge value={trend.accuracyDiff} unit="%" />
                    </div>
                    <div className={styles.metricValue}>
                        {current.accuracy}
                        <span className={styles.metricUnit}>%</span>
                    </div>
                    <div className={styles.accuracyBar}>
                        <div
                            className={styles.accuracyBarFill}
                            style={{
                                width: `${current.accuracy}%`,
                                background: getAccuracyColor(current.accuracy),
                            }}
                        />
                    </div>
                </div>

                {/* 学習日数 */}
                <div className={styles.metricItem}>
                    <div className={styles.metricHeader}>
                        <span className={styles.metricLabel}>📅 学習日数</span>
                        <TrendBadge value={trend.studyDaysDiff} unit="日" />
                    </div>
                    <div className={styles.metricValue}>
                        {current.studyDays}
                        <span className={styles.metricUnit}>日</span>
                    </div>
                </div>

                {/* 正解数 */}
                <div className={styles.metricItem}>
                    <div className={styles.metricHeader}>
                        <span className={styles.metricLabel}>✅ 正解数</span>
                        <TrendBadge value={trend.correctCountDiff} unit="問" />
                    </div>
                    <div className={styles.metricValue}>
                        {current.correctCount}
                        <span className={styles.metricUnit}>問</span>
                    </div>
                </div>
            </div>

            {/* フッター: 先月の参考値 */}
            {previous.questionCount > 0 && (
                <div className={styles.footer}>
                    <span className={styles.footerLabel}>先月実績:</span>
                    <div className={styles.footerStats}>
                        <span>
                            <span className={styles.footerStatValue}>{previous.questionCount}</span>問
                        </span>
                        <span>
                            正答率 <span className={styles.footerStatValue}>{previous.accuracy}</span>%
                        </span>
                        <span>
                            <span className={styles.footerStatValue}>{previous.studyDays}</span>日
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
