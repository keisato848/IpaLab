'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserMenu } from '@/components/features/auth/UserMenu';
import dynamic from 'next/dynamic';
import styles from './layout.module.css';

// 広告コンポーネントを動的インポート
const AdBanner = dynamic(() => import('@/components/common/AdBanner'), {
  ssr: false,
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  // Helper to check active link
  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <div className={styles.container}>
      {/* Mobile Header */}
      <header className={styles.mobileHeader}>
        <button className={styles.hamburger} onClick={toggleSidebar}>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
        </button>
        <Link href="/" className={styles.mobileLogo}>シカクノ</Link>
      </header>

      {/* Overlay for mobile */}
      {isSidebarOpen && <div className={styles.overlay} onClick={closeSidebar}></div>}

      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ''}`}>
        <div className={styles.logoArea}>
          <Link href="/" className={styles.logo}>シカクノ</Link>
        </div>

        <nav className={styles.nav}>
          <Link
            href="/dashboard"
            className={`${styles.navItem} ${pathname === '/dashboard' ? styles.active : ''}`}
            onClick={closeSidebar}
          >
            <span className={styles.icon}>📊</span>
            ダッシュボード
          </Link>
          <Link
            href="/plan"
            className={`${styles.navItem} ${isActive('/plan') ? styles.active : ''}`}
            onClick={closeSidebar}
          >
            <span className={styles.icon}>📅</span>
            学習計画
          </Link>
          <Link
            href="/exam"
            className={`${styles.navItem} ${isActive('/exam') ? styles.active : ''}`}
            onClick={closeSidebar}
          >
            <span className={styles.icon}>📝</span>
            演習・模擬試験
          </Link>
          <Link
            href="/history"
            className={`${styles.navItem} ${isActive('/history') ? styles.active : ''}`}
            onClick={closeSidebar}
          >
            <span className={styles.icon}>🕰️</span>
            学習履歴
          </Link>
          <Link
            href="/settings"
            className={`${styles.navItem} ${isActive('/settings') ? styles.active : ''}`}
            onClick={closeSidebar}
          >
            <span className={styles.icon}>⚙️</span>
            設定
          </Link>
        </nav>

        <div className={styles.userSection}>
          <UserMenu />
        </div>
      </aside>

      <main className={styles.mainContent}>
        {children}
        
        {/* 広告バナー：メインコンテンツの下部 */}
        <AdBanner 
          dataAdSlot="0987654321"
          dataAdFormat="horizontal"
        />
      </main>
    </div>
  );
}
