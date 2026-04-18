'use client';

interface RobotIconProps {
    size?: number;
    className?: string;
}

export default function RobotIcon({ size = 32, className }: RobotIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            {/* アンテナ */}
            <line x1="50" y1="18" x2="50" y2="6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <circle cx="50" cy="4" r="5" fill="currentColor" />

            {/* 頭 */}
            <rect x="20" y="20" width="60" height="56" rx="16" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="3" />

            {/* 耳 */}
            <rect x="10" y="35" width="10" height="18" rx="5" fill="currentColor" opacity="0.4" />
            <rect x="80" y="35" width="10" height="18" rx="5" fill="currentColor" opacity="0.4" />

            {/* 目 */}
            <circle cx="38" cy="44" r="10" fill="currentColor" />
            <circle cx="62" cy="44" r="10" fill="currentColor" />
            <circle cx="41" cy="41" r="4" fill="white" opacity="0.9" />
            <circle cx="65" cy="41" r="4" fill="white" opacity="0.9" />

            {/* 口（笑顔） */}
            <path d="M 36 60 Q 50 72 64 60" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" />

            {/* 体 */}
            <rect x="30" y="78" width="40" height="16" rx="6" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}
