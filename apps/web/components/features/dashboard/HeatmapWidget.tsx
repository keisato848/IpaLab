'use client';

import { LearningRecord } from '@/lib/api';
import styles from './HeatmapWidget.module.css';

interface HeatmapWidgetProps {
    records: LearningRecord[];
}

export default function HeatmapWidget({ records }: HeatmapWidgetProps) {
    // Generate last 365 days (or simplified: last 3 months ~ 90 days for mobile friendliness)
    // Let's do roughly 3 months for better mobile view, or a grid.
    // GitHub style: 7 rows (days), X columns (weeks).

    // We'll show the last 12 weeks.
    const weeksToShow = 16;
    const today = new Date();

    // Normalize today to start of day
    today.setHours(0, 0, 0, 0);

    // Calculate start date (Sunday of 12 weeks ago)
    const endDate = new Date(today);
    // Find last Saturday or today
    // Let's align so endDate is the last day shown.

    const days: Date[] = [];
    const totalDays = weeksToShow * 7;

    // We want the grid to end on the current week.
    // Let's simply generate days backwards from today+offset to fill the grid.
    // GitHub grid usually fills columns left to right.

    // Group records by YYYY-MM-DD
    const counts = new Map<string, number>();
    records.forEach(r => {
        const d = new Date(r.answeredAt);
        const key = d.toDateString();
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    // Generate grid data
    // We need 7 rows, 16 columns. 
    // Col 0 is 15 weeks ago.
    // Start date = today - (today.day + (weeks-1)*7) sort of logic?
    // Let's just create a list of dates and map them.

    // Easier: Generate the last (weeksToShow * 7) days ending today.
    // But we want to align to weeks (Sunday start).
    const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)

    // We want the last column to contain today.
    // So the end of the grid should be upcoming Saturday (or today).
    // Let's say we end on today.

    // Start date calculation:
    // We need 16 columns.
    // The current week is the last column.
    // The start date of the last column is `today - dayOfWeek`.
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - dayOfWeek);

    const startDate = new Date(currentWeekStart);
    startDate.setDate(currentWeekStart.getDate() - (weeksToShow - 1) * 7);

    // Create 2D array [row][col] or just list of weeks.
    // Use weeks list.
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
