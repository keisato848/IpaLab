import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/" className={styles.logo}>シカクノ</Link>
                <nav className={styles.nav}>
                    <Link href="/api/auth/signin" className={styles.loginLink}>ログイン</Link>
                </nav>
            </header>

            <main className={styles.main}>
                <section className={styles.hero}>
                    <h1 className={styles.title}>
                        情報処理をもっとスマートに。
                    </h1>
                    <p className={styles.description}>
                        シカクノは、効率的な学習をサポートする<br />
                        情報処理技術者試験の過去問演習プラットフォームです。
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
                &copy; 2024 シカクノ (Shikaku-No) Project
            </footer>
        </div>
    );
}
