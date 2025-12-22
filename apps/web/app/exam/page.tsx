import styles from './page.module.css';
import Link from 'next/link';

// Mock Data for Exam List
const EXAMS = [
    {
        id: 'AP-2023-Fall',
        title: '応用情報技術者試験 令和5年 秋期',
        date: '2023-10-08',
        stats: { total: 80, completed: 15, correctRate: 0.6 }
    },
    {
        id: 'AP-2023-Spring',
        title: '応用情報技術者試験 令和5年 春期',
        date: '2023-04-16',
        stats: { total: 80, completed: 0, correctRate: 0 }
    },
    {
        id: 'AP-2022-Fall',
        title: '応用情報技術者試験 令和4年 秋期',
        date: '2022-10-09',
        stats: { total: 80, completed: 80, correctRate: 0.75 }
    },
];

export default function ExamListPage() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>演習・模擬試験</h1>
                <p className={styles.subtitle}>過去問題を選択して学習を開始しましょう。</p>
            </header>

            <div className={styles.grid}>
                {EXAMS.map((exam) => (
                    <Link href={`/exam/${exam.id}/AM1`} key={exam.id} className={styles.cardLink}>
                        <article className={styles.card}>
                            <div className={styles.cardHeader}>
                                <span className={styles.tag}>AP</span>
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
                ))}
            </div>
        </div>
    );
}
