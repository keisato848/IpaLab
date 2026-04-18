'use client';

import styles from './ai-assistant.module.css';

interface RateLimitBadgeProps {
    remaining: number;
    limit: number;
}

export default function RateLimitBadge({ remaining, limit }: RateLimitBadgeProps) {
    const isWarning = remaining <= 3;
    const isExhausted = remaining <= 0;

    return (
        <span
            className={`${styles.rateBadge} ${isWarning ? styles.rateBadgeWarning : ''}`}
            aria-label={`残り質問回数 ${remaining}回`}
        >
            {isExhausted ? '明日リセット' : `残り ${remaining}/${limit} 回`}
        </span>
    );
}
