'use client';

import styles from './page.module.css';
import Link from 'next/link';

import { useEffect, useState } from 'react';
import { getExams, Exam } from '@/lib/api';

export default function ExamListPage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [timeFilter, setTimeFilter] = useState('ALL');

    useEffect(() => {
        async function fetchExams() {
            try {
                const data = await getExams();
                setExams(data);
            } catch (error) {
                console.error("Failed to load exams", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchExams();
    }, []);

    const filteredExams = exams.filter(e => {
        const catMatch = filter === 'ALL' || e.category === filter;
        let timeMatch = true;

        if (timeFilter === 'AM') {
            timeMatch = e.id.includes('AM') || e.title.includes('午前');
        } else if (timeFilter === 'PM') {
            // Must handle "PM" category prefix vs "PM" time suffix
            // If it is explicitly AM session, it is not PM time.
            const isAM = e.id.includes('AM') || e.title.includes('午前');
            // If it's not AM, and has PM indicator (title or ID suffix)
            // Note: PM category starts with PM-. We want to avoid matching that prefix as "Time=PM".
            // We check if it HAS 'PM' but NOT just at start, or if Title has '午後'.
            const hasPMSign = e.id.includes('PM') || e.title.includes('午後');

            // Refined: 
            // 1. Must NOT be AM.
            // 2. Must HAVE '午後' in title OR end with PM/PM1/PM2.
            // Logic: PM exams usually end with -PM, -PM1, -PM2.
            // Project Manager exams start with PM-.

            if (isAM) {
                timeMatch = false;
            } else {
                timeMatch = e.title.includes('午後') || e.id.endsWith('PM') || e.id.includes('-PM');
            }
        }
        return catMatch && timeMatch;
    });

    if (isLoading) {
        return <div className={styles.container}><p>読み込み中...</p></div>;
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>演習・模擬試験</h1>
                <p className={styles.subtitle}>過去問題を選択して学習を開始しましょう。</p>
            </header>

            <div className={styles.filterContainer}>
                <div className={styles.filterSection}>
                    {/* Category Filters */}
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>区分:</span>
                        <div className={styles.filterButtons}>
                            <button onClick={() => setFilter('ALL')} className={`${styles.filterBtn} ${filter === 'ALL' ? styles.filterBtnSelected : ''}`}>すべて</button>
                            <button onClick={() => setFilter('AP')} className={`${styles.filterBtn} ${filter === 'AP' ? styles.filterBtnSelected : ''}`}>応用情報 (AP)</button>
                            <button onClick={() => setFilter('FE')} className={`${styles.filterBtn} ${filter === 'FE' ? styles.filterBtnSelected : ''}`}>基本情報 (FE)</button>
                            <button onClick={() => setFilter('PM')} className={`${styles.filterBtn} ${filter === 'PM' ? styles.filterBtnSelected : ''}`}>プロマネ (PM)</button>
                        </div>
                    </div>

                    {/* Time Filters */}
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>時間帯:</span>
                        <div className={styles.filterButtons}>
                            <button onClick={() => setTimeFilter('ALL')} className={`${styles.filterBtn} ${timeFilter === 'ALL' ? styles.filterBtnSelected : ''}`}>すべて</button>
                            <button onClick={() => setTimeFilter('AM')} className={`${styles.filterBtn} ${timeFilter === 'AM' ? styles.filterBtnSelected : ''}`}>午前 (AM)</button>
                            <button onClick={() => setTimeFilter('PM')} className={`${styles.filterBtn} ${timeFilter === 'PM' ? styles.filterBtnSelected : ''}`}>午後 (PM)</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.grid}>
                {filteredExams.length === 0 ? (
                    <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        該当する試験区分は見つかりませんでした。
                    </p>
                ) : (
                    filteredExams.map((exam) => {
                        let startType = 'AM1';
                        if (exam.id.includes('AM2')) startType = 'AM2';
                        else if (exam.id.includes('PM') && !exam.id.startsWith('PM-')) startType = 'PM';

                        return (
                            <Link href={`/exam/${exam.id}/${startType}`} key={exam.id} className={styles.cardLink}>
                                <article className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <span className={styles.tag}>{exam.category}</span>
                                        <span className={styles.date}>{exam.date}</span>
                                    </div>
                                    <h3 className={styles.title}>{exam.title}</h3>

                                    <div className={styles.stats}>
                                        <div className={styles.statItem}>
                                            <span className={styles.statLabel}>進捗率</span>
                                            <span className={styles.statValue}>{Math.round((exam.stats.completed / exam.stats.total) * 100)}%</span>
                                        </div>
                                        <div className={styles.statItem}>
                                            <span className={styles.statLabel}>正答率</span>
                                            <span className={styles.statValue}>{Math.round(exam.stats.correctRate * 100)}%</span>
                                        </div>
                                    </div>

                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill} style={{ width: `${(exam.stats.completed / exam.stats.total) * 100}%` }}></div>
                                    </div>
                                </article>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
}
