'use client';

import styles from './ai-assistant.module.css';

interface InitialMenuProps {
    currentPage: 'exam' | 'admin' | 'other';
    onBugReport: () => void;
    onQuestion: () => void;
}

export default function InitialMenu({ currentPage, onBugReport, onQuestion }: InitialMenuProps) {
    return (
        <div className={styles.menuContainer}>
            <button className={styles.menuButton} onClick={onBugReport}>
                <span className={styles.menuIcon}>🐛</span>
                <span className={styles.menuLabel}>障害を報告する</span>
            </button>
            {currentPage !== 'admin' && (
                <button className={styles.menuButton} onClick={onQuestion}>
                    <span className={styles.menuIcon}>💡</span>
                    <span className={styles.menuLabel}>質問する</span>
                </button>
            )}
        </div>
    );
}
