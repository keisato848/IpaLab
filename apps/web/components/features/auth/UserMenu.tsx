'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import styles from './UserMenu.module.css';

export function UserMenu() {
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return <div className={styles.loading}>Loading...</div>;
    }

    if (!session) {
        return (
            <div className={styles.guest}>
                <div className={styles.avatar}>G</div>
                <div className={styles.info}>
                    <div className={styles.name}>ゲスト</div>
                    <Link href="/login" className={styles.loginLink}>ログイン / 登録</Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.user}>
            {session.user?.image ? (
                <img src={session.user.image} alt="User Avatar" className={styles.avatarImage} />
            ) : (
                <FaUserCircle className={styles.avatarIcon} />
            )}

            <div className={styles.info}>
                <div className={styles.name}>{session.user?.name || 'User'}</div>
                <button className={styles.logout} onClick={() => signOut()}>
                    <FaSignOutAlt /> ログアウト
                </button>
            </div>
        </div>
    );
}
