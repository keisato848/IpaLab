'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './admin.module.css';

interface FeatureFlag {
    id: string;
    enabled: boolean;
    description: string;
    updatedAt: string;
    updatedBy: string;
}

export default function AdminPage() {
    const { data: session, status } = useSession();
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    const isAdmin = session?.user?.role === 'admin';

    const fetchFlags = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/admin/feature-flags');
            if (!res.ok) {
                if (res.status === 403) {
                    setError('管理者権限がありません');
                    return;
                }
                throw new Error('フラグの取得に失敗しました');
            }
            const data = await res.json();
            setFlags(data.flags);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            fetchFlags();
        } else {
            setLoading(false);
        }
    }, [isAdmin, fetchFlags]);

    const toggleFlag = async (id: string, currentEnabled: boolean) => {
        setUpdating(id);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch('/api/admin/feature-flags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, enabled: !currentEnabled }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '更新に失敗しました');
            }

            const data = await res.json();

            // ローカル状態を更新
            setFlags(prev =>
                prev.map(f => (f.id === id ? data.flag : f))
            );

            setSuccess(`「${data.flag.description}」を${data.flag.enabled ? '有効' : '無効'}にしました`);

            // 成功メッセージを3秒後に消す
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : '更新エラーが発生しました');
        } finally {
            setUpdating(null);
        }
    };

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return iso;
        }
    };

    // 読み込み中
    if (status === 'loading' || (loading && isAdmin)) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <span className={styles.spinner}></span>
                    読み込み中...
                </div>
            </div>
        );
    }

    // 未認証 or 非管理者
    if (!session || !isAdmin) {
        return (
            <div className={styles.container}>
                <AdminSetup session={session} />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>管理画面</h1>
                <span className={styles.badge}>🛡️ Admin</span>
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {success && <div className={styles.success}>{success}</div>}

            {/* フィーチャーフラグセクション */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <span>🚩</span>
                    フィーチャーフラグ
                </h2>

                {flags.map(flag => (
                    <div key={flag.id} className={styles.flagRow}>
                        <div className={styles.flagInfo}>
                            <span className={styles.flagId}>{flag.id}</span>
                            <span className={flag.enabled ? styles.statusOn : styles.statusOff}>
                                {flag.enabled ? 'ON' : 'OFF'}
                            </span>
                            <div className={styles.flagDescription}>{flag.description}</div>
                            <div className={styles.flagMeta}>
                                最終更新: {formatDate(flag.updatedAt)}
                            </div>
                        </div>
                        <label className={styles.toggleSwitch}>
                            <input
                                type="checkbox"
                                checked={flag.enabled}
                                disabled={updating === flag.id}
                                onChange={() => toggleFlag(flag.id, flag.enabled)}
                            />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                ))}

                {flags.length === 0 && !loading && (
                    <div className={styles.flagRow}>
                        <div className={styles.flagInfo}>
                            <div className={styles.flagDescription}>
                                フィーチャーフラグが見つかりません。
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * 管理者セットアップコンポーネント
 * 管理者が存在しない初回セットアップ時に表示
 */
function AdminSetup({ session }: { session: any }) {
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/admin/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setupToken: token }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'セットアップに失敗しました');
            }

            setSuccess(data.message);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    if (!session) {
        return (
            <div className={styles.accessDenied}>
                <div className={styles.accessDeniedIcon}>🔒</div>
                <h2 className={styles.accessDeniedTitle}>アクセスが制限されています</h2>
                <p className={styles.accessDeniedMessage}>
                    このページを表示するにはログインが必要です。
                </p>
                <Link href="/login" className={styles.backLink}>
                    ログインページへ
                </Link>
            </div>
        );
    }

    return (
        <div>
            <div className={styles.accessDenied}>
                <div className={styles.accessDeniedIcon}>🔒</div>
                <h2 className={styles.accessDeniedTitle}>管理者権限が必要です</h2>
                <p className={styles.accessDeniedMessage}>
                    このページは管理者のみアクセスできます。
                </p>
                <Link href="/dashboard" className={styles.backLink}>
                    ダッシュボードへ戻る
                </Link>
            </div>

            {/* 初回セットアップフォーム */}
            <div className={styles.setupSection}>
                <h2 className={styles.sectionTitle}>
                    <span>🔧</span>
                    初回管理者セットアップ
                </h2>
                <p className={styles.flagMeta}>
                    まだ管理者が設定されていない場合、セットアップトークンを入力して管理者権限を取得できます。
                </p>

                {error && <div className={styles.error}>{error}</div>}
                {success && <div className={styles.success}>{success}</div>}

                <form className={styles.setupForm} onSubmit={handleSetup}>
                    <input
                        type="password"
                        className={styles.setupInput}
                        placeholder="セットアップトークン"
                        value={token}
                        onChange={e => setToken(e.target.value)}
                        disabled={loading || !!success}
                    />
                    <button
                        type="submit"
                        className={styles.setupButton}
                        disabled={loading || !token.trim() || !!success}
                    >
                        {loading ? '処理中...' : '管理者に設定'}
                    </button>
                </form>
            </div>
        </div>
    );
}
