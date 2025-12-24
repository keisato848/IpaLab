'use client';

import styles from './page.module.css';
import Link from 'next/link';

import { useEffect, useState } from 'react';
import { getExams, Exam } from '@/lib/api';

export default function ExamListPage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

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

    const filteredExams = filter === 'ALL'
        ? exams
        : exams.filter(e => e.category === filter);

    if (isLoading) {
        return <div className={styles.container}><p>読み込み中...</p></div>;
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>演習・模擬試験</h1>
                <p className={styles.subtitle}>過去問題を選択して学習を開始しましょう。</p>
            </header>

            <div className={styles.filters} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <button
                    onClick={() => setFilter('ALL')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #ddd',
                        backgroundColor: filter === 'ALL' ? '#0070f3' : 'white',
                        color: filter === 'ALL' ? 'white' : '#333',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    すべて
                </button>
                <button
                    onClick={() => setFilter('AP')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #ddd',
                        backgroundColor: filter === 'AP' ? '#0070f3' : 'white',
                        color: filter === 'AP' ? 'white' : '#333',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    応用情報 (AP)
                </button>
                <button
                    onClick={() => setFilter('FE')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #ddd',
                        backgroundColor: filter === 'FE' ? '#0070f3' : 'white',
                        color: filter === 'FE' ? 'white' : '#333',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    基本情報 (FE)
                </button>
            </div>

            <div className={styles.grid}>
                {filteredExams.length === 0 ? (
                    <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#666' }}>
                        該当する試験区分は見つかりませんでした。
                    </p>
                ) : (
                    filteredExams.map((exam) => (
                        <Link href={`/exam/${exam.id}/AM1`} key={exam.id} className={styles.cardLink}>
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
                    ))
                )}
            </div>
        </div>
    );
}
