'use client';

import styles from './ai-assistant.module.css';

interface FloatingButtonProps {
    isOpen: boolean;
    onClick: () => void;
}

export default function FloatingButton({ isOpen, onClick }: FloatingButtonProps) {
    return (
        <button
            className={styles.fab}
            onClick={onClick}
            aria-label={isOpen ? 'AIアシスタントを閉じる' : 'AIアシスタントを開く'}
            role="button"
        >
            {isOpen ? '✕' : '💬'}
        </button>
    );
}
