'use client';

import { useMemo } from 'react';
import { LearningRecord } from '@/lib/api';
import styles from './HeatmapWidget.module.css';

interface HeatmapWidgetProps {
    records: LearningRecord[];
}

export default function HeatmapWidget({ records }: HeatmapWidgetProps) {

    const heatmapData = useMemo(() => {
        const weeksToShow = 16;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Group records by YYYY-MM-DD for quick lookup
        const counts = new Map<string, number>();
        records.forEach(r => {
            const key = new Date(r.answeredAt).toDateString();
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        // Calculate the grid of dates
        const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - dayOfWeek);

        const startDate = new Date(currentWeekStart);
        startDate.setDate(currentWeekStart.getDate() - (weeksToShow - 1) * 7);

        const weeks: Date[][] = [];
        let currentD = new Date(startDate);
        for (let w = 0; w < weeksToShow; w++) {
            const weekDays: Date[] = [];
            for (let d = 0; d < 7; d++) {
                weekDays.push(new Date(currentD));
                currentD.setDate(currentD.getDate() + 1);
            }
            weeks.push(weekDays);
        }

        return { weeks, counts, today };
    }, [records]);

    const { weeks, counts, today } = heatmapData;

    const getColorClass = (count: number) => {
        if (count === 0) return styles.level0;
        if (count <= 2) return styles.level1;
        if (count <= 5) return styles.level2;
        if (count <= 10) return styles.level3;
        return styles.level4;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>学習ヒートマップ</h3>
                <span className={styles.subtitle}>継続は力なり</span>
            </div>

            <div className={styles.scrollContainer}>
                <div className={styles.heatmap}>
                    {weeks.map((week, wIndex) => (
                        <div key={wIndex} className={styles.weekCol}>
                            {week.map((date, dIndex) => {
                                const count = counts.get(date.toDateString()) || 0;
                                // Don't show future days if we aligned to end of week
                                const isFuture = date > today;
                                if (isFuture) return <div key={dIndex} className={styles.emptyDay}></div>;

                                return (
                                    <div
                                        key={dIndex}
                                        className={`${styles.day} ${getColorClass(count)}`}
                                        title={`${date.toLocaleDateString()}: ${count}問`}
                                    ></div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.legend}>
                <span>Less</span>
                <div className={`${styles.day} ${styles.level0}`}></div>
                <div className={`${styles.day} ${styles.level1}`}></div>
                <div className={`${styles.day} ${styles.level2}`}></div>
                <div className={`${styles.day} ${styles.level3}`}></div>
                <div className={`${styles.day} ${styles.level4}`}></div>
                <span>More</span>
            </div>
        </div>
    );
}
