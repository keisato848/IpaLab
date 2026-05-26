'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import styles from './UserMenu.module.css';

export function UserMenu() {
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return <div className={styles.loading}>Loading...</div>;
    }

    const handleSignOut = async () => {
        try {
            // redirect: false で signOut し、完了後にハードリロードでクッキーを確実にクリア
            await signOut({ redirect: false });
        } catch {
            // signOut が失敗しても手動でクッキーを削除
            document.cookie.split(';').forEach(cookie => {
                const name = cookie.split('=')[0].trim();
                if (name.includes('next-auth')) {
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                }
            });
        }
        // フルリロードでサーバー側のセッションも確実にクリア
        window.location.href = '/';
    };

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
                <Image
                    src={session.user.image}
                    alt="User Avatar"
                    width={40}
                    height={40}
                    className={styles.avatarImage}
                />
            ) : (
                <FaUserCircle className={styles.avatarIcon} />
            )}

            <div className={styles.info}>
                <div className={styles.name} data-user-identity>{session.user?.name || 'User'}</div>
                <button type="button" className={styles.logout} onClick={handleSignOut}>
                    <FaSignOutAlt /> ログアウト
                </button>
            </div>
        </div>
    );
}
