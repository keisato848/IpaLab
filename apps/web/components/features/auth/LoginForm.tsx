'use client';

import { signIn } from 'next-auth/react';
import { FaGithub, FaGoogle } from 'react-icons/fa';
import styles from './LoginForm.module.css';

export function LoginForm() {
    const handleLogin = (provider: 'github' | 'google') => {
        signIn(provider, { callbackUrl: '/dashboard' });
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>ログイン / 新規登録</h2>
            <p className={styles.description}>
                学習履歴を保存して、効率的に学習を進めましょう。
            </p>

            <div className={styles.buttons}>
                <button
                    className={`${styles.button} ${styles.google}`}
                    onClick={() => handleLogin('google')}
                >
                    <FaGoogle className={styles.icon} />
                    <span>Google で続ける</span>
                </button>

                <button
                    className={`${styles.button} ${styles.github}`}
                    onClick={() => handleLogin('github')}
                >
                    <FaGithub className={styles.icon} />
                    <span>GitHub で続ける</span>
                </button>
            </div>

            <div className={styles.divider}>
                <span>または</span>
            </div>

            <div className={styles.guest}>
                <p>まずは試してみたい方へ</p>
                <button className={styles.guestButton} onClick={() => window.location.href = '/exam'}>
                    ゲストとして利用する
                </button>
            </div>
        </div>
    );
}
