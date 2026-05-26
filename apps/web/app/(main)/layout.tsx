'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserMenu } from '@/components/features/auth/UserMenu';
import styles from './layout.module.css';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'ipalab_main_sidebar_collapsed_v1';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  // ページビュートラッキングは TelemetryProvider（App Insights SDK）が担当

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    setIsSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true');
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleDesktopSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  // Helper to check active link
  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <div className={`${styles.container} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      {/* Mobile Header */}
      <header className={styles.mobileHeader}>
        <button type="button" className={styles.hamburger} onClick={toggleSidebar}>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
        </button>
        <Link href="/" className={styles.mobileLogo}>シカクノ</Link>
      </header>

      {/* Overlay for mobile */}
      {isSidebarOpen && <div className={styles.overlay} onClick={closeSidebar}></div>}

      {isSidebarCollapsed && (
        <button
          type="button"
          className={styles.sidebarRestoreButton}
          onClick={toggleDesktopSidebar}
          aria-label="サイドナビを表示"
          aria-expanded="false"
          aria-controls="main-sidebar"
        >
          <span aria-hidden="true">☰</span>
        </button>
      )}

      <aside id="main-sidebar" className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ''}`}>
        <div className={styles.logoArea}>
          <Link href="/" className={styles.logo}>シカクノ</Link>
          <button
            type="button"
            className={styles.sidebarCollapseButton}
            onClick={toggleDesktopSidebar}
            aria-label="サイドナビを隠す"
            aria-expanded="true"
            aria-controls="main-sidebar"
          >
            <span aria-hidden="true">‹</span>
          </button>
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
          {isAdmin && (
            <Link
              href="/admin"
              className={`${styles.navItem} ${isActive('/admin') ? styles.active : ''}`}
              onClick={closeSidebar}
            >
              <span className={styles.icon}>🛡️</span>
              管理
            </Link>
          )}
        </nav>

        <div className={styles.userSection}>
          <UserMenu />
        </div>
      </aside>

      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
