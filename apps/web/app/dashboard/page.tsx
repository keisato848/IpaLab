import styles from './page.module.css';

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.welcomeText}>
          <h1>こんにちは、ゲストさん 👋</h1>
          <p className={styles.subtitle}>今日も一日、知識を積み重ねましょう。</p>
        </div>
        <div className={styles.dateDisplay}>
          {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </div>
      </header>

      <div className={styles.grid}>
        {/* Today's Status */}
        <section className={`${styles.card} ${styles.statusCard}`}>
          <div className={styles.cardHeader}>
            <h3>今日の目標</h3>
            <span className={styles.cardIcon}>🎯</span>
          </div>
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: '30%' }}></div>
            </div>
            <div className={styles.progressStats}>
              <span className={styles.progressText}>3 / 10 問</span>
              <span className={styles.progressPercent}>30%</span>
            </div>
          </div>
          <button className={styles.quickStartBtn}>クイックスタート (続きから)</button>
        </section>

        {/* Analytics: Radar Chart Stub */}
        <section className={`${styles.card} ${styles.radarCard}`}>
          <h3>弱点分析</h3>
          <div className={styles.chartPlaceholder}>
            <div className={styles.chartStubCircle}>
              <span>分析データ不足</span>
            </div>
            <p className={styles.chartNote}>問題を解くと、ここに分野別の得意・不得意が表示されます。</p>
          </div>
        </section>

        {/* Analytics: Line Chart Stub */}
        <section className={`${styles.card} ${styles.lineCard}`}>
          <h3>成長推移</h3>
          <div className={styles.chartPlaceholder}>
            <div className={styles.chartStubGraph}></div>
            <p className={styles.chartNote}>日々の正解率の推移がここにグラフ化されます。</p>
          </div>
        </section>

        {/* Recent History */}
        <section className={`${styles.card} ${styles.historyCard}`}>
          <div className={styles.cardHeader}>
            <h3>最近の活動</h3>
            <button className={styles.viewAllBtn}>すべて見る</button>
          </div>
          <ul className={styles.historyList}>
            <li className={styles.historyItem}>
              <div className={styles.historyMain}>
                <span className={styles.tag}>セキュリティ</span>
                <span className={styles.examName}>AP 令和5年 秋期 AM1</span>
              </div>
              <div className={styles.historyMeta}>
                <span className={`${styles.result} ${styles.correct}`}>正解</span>
                <span className={styles.date}>10分前</span>
              </div>
            </li>
            <li className={styles.historyItem}>
              <div className={styles.historyMain}>
                <span className={styles.tag}>ネットワーク</span>
                <span className={styles.examName}>AP 令和5年 秋期 AM1</span>
              </div>
              <div className={styles.historyMeta}>
                <span className={`${styles.result} ${styles.incorrect}`}>不正解</span>
                <span className={styles.date}>1時間前</span>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
