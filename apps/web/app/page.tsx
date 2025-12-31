import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
    // Structured Data (JSON-LD)
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "シカクノ",
        "url": "https://shikakuno.vercel.app",
        "description": "忙しいエンジニアのための情報処理技術者試験（基本情報・応用情報・PM）最短合格プラットフォーム。学習データを分析し、あなただけの効率的な学習戦略を提供します。",
        "applicationCategory": "EducationalApplication",
        "operatingSystem": "Web Browser",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "JPY"
        },
        "featureList": [
            "過去問演習",
            "学習履歴分析",
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
                    <Link href="/api/auth/signin" className={styles.loginLink}>ログイン / 登録</Link>
                </nav>
            </header>

            <main className={styles.main}>
                <section className={styles.hero}>
                    <h1 className={styles.title}>
                        <span style={{ fontSize: '0.6em', display: 'block', marginBottom: '0.5rem', opacity: 0.9 }}>忙しいエンジニアのための、</span>
                        データ駆動型<br className={styles.mobileBr} />過去問演習。
                    </h1>
                    <p className={styles.description}>
                        ただ解くだけの学習は、もう終わり。<br />
                        情報処理技術者試験（基本情報/応用情報/高度）の<br className={styles.mobileBr} />
                        <strong>「苦手分野」を可視化</strong>し、<br className={styles.mobileBr} />
                        最短距離で合格をつかみ取りましょう。
                    </p>

                    <div className={styles.actions}>
                        <Link href="/dashboard" className={styles.primaryBtn}>
                            登録なしで、<br className={styles.mobileOnly} />実力を試す (無料)
                        </Link>
                        <Link href="/api/auth/signin" className={styles.secondaryBtn}>
                            履歴を保存して<br className={styles.mobileOnly} />始める
                        </Link>
                    </div>
                    <p className={styles.note}>※ゲストモードでも、学習データはブラウザに一時保存されます。</p>
                </section>

                <section className={styles.features}>
                    <div className={styles.featureCard}>
                        <h2>🎯 スキマ時間を得点源に</h2>
                        <p>厳選された過去問データベース。通勤中や休憩タイムの5分を使って、着実に知識を定着させます。</p>
                    </div>
                    <div className={styles.featureCard}>
                        <h2>📊 「苦手」をAIが特定</h2>
                        <p>学習結果を自動分析。あなたが落としやすい分野だけをピンポイントで特定し、無駄のない復習へと導きます。</p>
                    </div>
                    <div className={styles.featureCard}>
                        <h2>📝 本番のプレッシャーを攻略</h2>
                        <p>本番と同じ時間配分で挑む「模擬試験モード」。今の実力と合格ラインとの距離を、正確に測ることができます。</p>
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                &copy; 2024 シカクノ (Shikaku-No) Project
            </footer>
        </div>
    );
}
