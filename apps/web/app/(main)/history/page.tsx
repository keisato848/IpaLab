import styles from './page.module.css';
import HistoryList from '@/components/features/history/HistoryList';

export default function HistoryPage() {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>学習履歴</h1>
                <span className={styles.subtitle}>過去の回答結果を確認できます</span>
            </div>
            <HistoryList />
        </div>
    );
}
