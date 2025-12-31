
'use client';

import { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import styles from './ExamSummary.module.css';
import { Question, LearningRecord } from '@/lib/api';
import { calculateExamResult, calculateAggregatedRadar } from '@/lib/scoring';

interface ExamSummaryProps {
    records: LearningRecord[];
    questions: Question[];
    title?: string;
}

export default function ExamSummary({ records, questions, title }: ExamSummaryProps) {
    const result = useMemo(() => calculateExamResult(records, questions), [records, questions]);
    const radarData = useMemo(() => calculateAggregatedRadar(records), [records]);

    if (!result || result.totalPoints === 0) return null;

    return (
        <div className={styles.container}>
            {title && <h3 className={styles.title}>{title}</h3>}

            <div className={styles.scoreBoard}>
                <div className={styles.scoreRow}>
                    <div className={styles.mainScore}>
                        <span className={styles.scoreLabel}>総合スコア</span>
                        <div className={`${styles.scoreValue} ${result.isPassed ? styles.passed : styles.failed}`}>
                            {result.totalScore}
                            <span className={styles.totalPoints}> / {result.totalPoints}</span>
                            <span className={styles.unit}>点</span>
                        </div>
                    </div>
                    <div className={styles.badgeWrapper}>
                        {result.isPassed ? (
                            <span className={styles.passBadge}>合格圏内</span>
                        ) : (
                            <span className={styles.failBadge}>あと {Math.max(0, Math.ceil(result.totalPoints * 0.6 - result.totalScore))} 点</span>
                        )}
                    </div>
                </div>

                <div className={styles.statsRow}>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>正答率</span>
                        <span className={styles.statValue}>{result.percentage}%</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>回答済</span>
                        <span className={styles.statValue}>{result.answeredCount} / {result.questionCount}</span>
                    </div>
                </div>
            </div>

            {/* Aggregated Radar Chart */}
            {radarData.length > 0 && (
                <div className={styles.chartSection}>
                    <h4 className={styles.chartTitle}>傾向分析 (平均)</h4>
                    <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height={200}>
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 10]} hide />
                                <Radar
                                    name="Average"
                                    dataKey="A"
                                    stroke="#8b5cf6"
                                    fill="#8b5cf6"
                                    fillOpacity={0.5}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
