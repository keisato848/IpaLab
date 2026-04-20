'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

const ITEMS: { href: string; label: string; icon: string; matchPrefix?: string }[] = [
    { href: '/', label: 'ホーム', icon: '🏠' },
    { href: '/dashboard', label: 'ミッション', icon: '🎯', matchPrefix: '/dashboard' },
    { href: '/exam', label: '問題', icon: '📚', matchPrefix: '/exam' },
    { href: '/history', label: '履歴', icon: '📊', matchPrefix: '/history' },
    { href: '/settings', label: '設定', icon: '⚙️', matchPrefix: '/settings' },
];

export default function BottomNav() {
    const pathname = usePathname() || '/';
    return (
        <nav className={styles.nav} aria-label="メインナビゲーション">
            {ITEMS.map(item => {
                const active = item.matchPrefix
                    ? pathname.startsWith(item.matchPrefix)
                    : pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`${styles.item} ${active ? styles.active : ''}`}
                        aria-current={active ? 'page' : undefined}
                    >
                        <span className={styles.icon} aria-hidden="true">{item.icon}</span>
                        <span className={styles.label}>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
