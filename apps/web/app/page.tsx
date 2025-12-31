import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
    // Structured Data (JSON-LD)
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "シカクノ",
        "url": "https://shikakuno.vercel.app",
        "description": "情報処理技術者試験（基本情報・応用情報・PMなど）の過去問演習プラットフォーム。学習履歴分析機能で効率的な合格をサポートします。",
        "applicationCategory": "EducationalApplication",
        "operatingSystem": "Web Browser",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "JPY"
        },
        "featureList": [
            "過去問演習",
            "弱点分析",
            "模擬試験モード",
            "レスポンシブデザイン"
        ],
        "author": {
            "@type": "Organization",
            "name": "Shikaku-No Project"
        }
    };

    return (
        <div className={styles.container}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
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
                        <h2>🎯 効率的な演習</h2>
                        <p>過去問を厳選。隙間時間にサクサク学習できます。</p>
                    </div>
                    <div className={styles.featureCard}>
                        <h2>📊 弱点分析</h2>
                        <p>学習データを分析し、あなたの苦手分野を可視化します。</p>
                    </div>
                    <div className={styles.featureCard}>
                        <h2>📝 模擬試験モード</h2>
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
