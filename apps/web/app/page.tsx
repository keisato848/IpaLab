import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.logo}>PM Exam DX</div>
                <nav className={styles.nav}>
                    <Link href="/api/auth/signin" className={styles.loginLink}>ログイン</Link>
                </nav>
            </header>

            <main className={styles.main}>
                <section className={styles.hero}>
                    <h1 className={styles.title}>
                        プロジェクトマネージャ試験を、<br />
                        もっとスマートに。
                    </h1>
                    <p className={styles.description}>
                        PM Exam DXは、効率的な学習をサポートする<br />
                        プロジェクトマネージャ試験対策プラットフォームです。
                    </p>

                    <div className={styles.actions}>
                        <Link href="/dashboard" className={styles.primaryBtn}>
                            ゲストとして始める
                        </Link>
                        <Link href="/api/auth/signin" className={styles.secondaryBtn}>
                            ログインして始める
                        </Link>
                    </div>
                    <p className={styles.note}>※ゲストモードでは履歴がブラウザに保存されます。</p>
                </section>

                <section className={styles.features}>
                    <div className={styles.featureCard}>
                        <h3>🎯 効率的な演習</h3>
                        <p>過去問を厳選。隙間時間にサクサク学習できます。</p>
                    </div>
                    <div className={styles.featureCard}>
                        <h3>📊 弱点分析</h3>
                        <p>学習データを分析し、あなたの苦手分野を可視化します。</p>
                    </div>
                    <div className={styles.featureCard}>
                        <h3>📝 模擬試験モード</h3>
                        <p>本番形式の時間制限付きモードで実力を試せます。</p>
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                &copy; 2024 PM Exam DX Team
            </footer>
        </div>
    );
}
