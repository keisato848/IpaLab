'use client';

import { useTheme } from '@/components/providers/ThemeProvider';
import styles from './settings.module.css';

export default function SettingsPage() {
    const { theme, toggleTheme, showExamStats, toggleShowExamStats } = useTheme();

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>設定</h1>

            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>表示・テーマ</h2>

                {/* Dark Mode Toggle */}
                <div className={styles.row}>
                    <div>
                        <div className={styles.label}>ダークモード</div>
                        <div className={styles.description}>暗いテーマを使用して目の疲れを軽減します。</div>
                    </div>
                    <label className={styles.toggleSwitch}>
                        <input
                            type="checkbox"
                            checked={theme === 'dark'}
                            onChange={toggleTheme}
                        />
                        <span className={styles.slider}></span>
                    </label>
                </div>

                {/* Exam Stats Toggle */}
                <div className={styles.row}>
                    <div>
                        <div className={styles.label}>演習中の統計表示</div>
                        <div className={styles.description}>
                            演習・試験画面のヘッダーに正答率統計を表示します。<br />
                            オフにしても、ヘッダーの「⚙️」からいつでも確認できます。
                        </div>
                    </div>
                    <label className={styles.toggleSwitch}>
                        <input
                            type="checkbox"
                            checked={showExamStats}
                            onChange={toggleShowExamStats}
                        />
                        <span className={styles.slider}></span>
                    </label>
                </div>
            </div>

            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>アカウント</h2>
                <div className={styles.row}>
                    <div>
                        <div className={styles.label}>学習データの同期</div>
                        <div className={styles.description}>現在は自動的にクラウドに同期されています。</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
