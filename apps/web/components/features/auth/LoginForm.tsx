'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { FaGithub, FaGoogle } from 'react-icons/fa';
import styles from './LoginForm.module.css';

/** NextAuth エラーコードからユーザー向けメッセージに変換 */
function getErrorMessage(error: string | null): string | null {
    if (!error) return null;
    const messages: Record<string, string> = {
        OAuthSignin: 'OAuth プロバイダーへの接続に失敗しました。',
        OAuthCallback: 'OAuth 認証のコールバック処理に失敗しました。',
        OAuthCreateAccount: 'アカウントの作成に失敗しました。',
        OAuthAccountNotLinked: 'このメールアドレスは別のログイン方法で登録されています。元の方法でログインしてください。',
        Callback: '認証処理中にエラーが発生しました。',
        AccessDenied: 'アクセスが拒否されました。',
        Configuration: 'サーバー設定にエラーがあります。管理者にお問い合わせください。',
        Default: '認証中にエラーが発生しました。もう一度お試しください。',
    };
    return messages[error] || messages.Default;
}

export function LoginForm() {
    const searchParams = useSearchParams();
    const errorParam = searchParams.get('error');
    const errorMessage = getErrorMessage(errorParam);
    const [loading, setLoading] = useState<string | null>(null);

    const handleLogin = async (provider: 'github' | 'google') => {
        setLoading(provider);
        try {
            await signIn(provider, { callbackUrl: '/dashboard' });
        } catch {
            setLoading(null);
        }
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>ログイン / 新規登録</h2>
            <p className={styles.description}>
                学習履歴を保存して、効率的に学習を進めましょう。
            </p>

            {errorMessage && (
                <div className={styles.error} role="alert">
                    {errorMessage}
                </div>
            )}

            <div className={styles.buttons}>
                <button
                    className={`${styles.button} ${styles.google}`}
                    onClick={() => handleLogin('google')}
                    disabled={loading !== null}
                >
                    {loading === 'google' ? (
                        <span className={styles.spinner} />
                    ) : (
                        <FaGoogle className={styles.icon} />
                    )}
                    <span>Google で続ける</span>
                </button>

                <button
                    className={`${styles.button} ${styles.github}`}
                    onClick={() => handleLogin('github')}
                    disabled={loading !== null}
                >
                    {loading === 'github' ? (
                        <span className={styles.spinner} />
                    ) : (
                        <FaGithub className={styles.icon} />
                    )}
                    <span>GitHub で続ける</span>
                </button>
            </div>

            <p className={styles.consent}>
                ログインすることで、
                <a href="/terms" className={styles.link} target="_blank" rel="noopener noreferrer">利用規約</a>
                および
                <a href="/privacy" className={styles.link} target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>
                に同意したものとみなします。
            </p>

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
