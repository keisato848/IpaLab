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

interface AnalyticsData {
    period: string;
    overview: {
        totalUsers: number;
        adminUsers: number;
        guestUsers: number;
        totalSessions: number;
        completedSessions: number;
        activeSessions: number;
        avgQuestionsPerSession: number;
        totalAnswers: number;
        correctAnswers: number;
        correctRate: number;
        avgTimeSec: number;
    };
    dailyActivity: { date: string; count: number; correctCount: number }[];
    examBreakdown: { examId: string; count: number; completedCount: number }[];
    recentUsers: { id: string; name: string | null; email: string | null; role: string; createdAt: string; isGuest: boolean }[];
    visitorStats: {
        totalPageViews: number;
        uniqueVisitors: number;
        authenticatedVisitors: number;
        anonymousVisitors: number;
        dailyVisitors: { date: string; total: number; authenticated: number; anonymous: number }[];
        topPages: { path: string; views: number }[];
    };
}

export default function AdminPage() {
    const { data: session, status } = useSession();
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const [loading, setLoading] = useState(true);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
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

    const fetchAnalytics = useCallback(async (period: string) => {
        try {
            setAnalyticsLoading(true);
            const res = await fetch(`/api/admin/analytics?period=${period}`);
            if (!res.ok) throw new Error('分析データの取得に失敗しました');
            const data = await res.json();
            setAnalytics(data);
        } catch (err) {
            console.error('Analytics fetch error:', err);
        } finally {
            setAnalyticsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            fetchFlags();
            fetchAnalytics(analyticsPeriod);
        } else {
            setLoading(false);
        }
    }, [isAdmin, fetchFlags, fetchAnalytics, analyticsPeriod]);

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

            {/* 利用状況分析セクション */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <span>📊</span>
                    利用状況分析
                </h2>

                <div className={styles.periodSelector}>
                    {(['7d', '30d', '90d'] as const).map(p => (
                        <button
                            key={p}
                            className={`${styles.periodButton} ${analyticsPeriod === p ? styles.periodButtonActive : ''}`}
                            onClick={() => setAnalyticsPeriod(p)}
                            disabled={analyticsLoading}
                        >
                            {p === '7d' ? '7日間' : p === '30d' ? '30日間' : '90日間'}
                        </button>
                    ))}
                </div>

                {analyticsLoading && !analytics ? (
                    <div className={styles.loading}>
                        <span className={styles.spinner}></span>
                        分析データを読み込み中...
                    </div>
                ) : analytics ? (
                    <>
                        {/* 概要カード */}
                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>👥</span>
                                <span className={styles.statValue}>{analytics.overview.totalUsers}</span>
                                <span className={styles.statLabel}>総ユーザー数</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>📝</span>
                                <span className={styles.statValue}>{analytics.overview.totalSessions}</span>
                                <span className={styles.statLabel}>総セッション数</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>✅</span>
                                <span className={styles.statValue}>{analytics.overview.completedSessions}</span>
                                <span className={styles.statLabel}>完了セッション</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>❓</span>
                                <span className={styles.statValue}>{analytics.overview.totalAnswers.toLocaleString()}</span>
                                <span className={styles.statLabel}>総回答数</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>🎯</span>
                                <span className={styles.statValue}>{analytics.overview.correctRate.toFixed(1)}%</span>
                                <span className={styles.statLabel}>正答率</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>⏱️</span>
                                <span className={styles.statValue}>{analytics.overview.avgTimeSec.toFixed(1)}s</span>
                                <span className={styles.statLabel}>平均回答時間</span>
                            </div>
                        </div>

                        {/* 訪問者統計（匿名ユーザー含む） */}
                        <h3 className={styles.sectionTitle} style={{ fontSize: '1rem', marginTop: '1.5rem' }}>
                            👁️ 訪問者統計
                        </h3>
                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>🌐</span>
                                <span className={styles.statValue}>{analytics.visitorStats.totalPageViews.toLocaleString()}</span>
                                <span className={styles.statLabel}>総ページビュー</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>👤</span>
                                <span className={styles.statValue}>{analytics.visitorStats.uniqueVisitors}</span>
                                <span className={styles.statLabel}>ユニーク訪問者</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>🔓</span>
                                <span className={styles.statValue}>{analytics.visitorStats.authenticatedVisitors}</span>
                                <span className={styles.statLabel}>ログインユーザー</span>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statIcon}>👻</span>
                                <span className={styles.statValue}>{analytics.visitorStats.anonymousVisitors}</span>
                                <span className={styles.statLabel}>匿名利用者</span>
                            </div>
                        </div>

                        {/* 日別訪問者数 */}
                        {analytics.visitorStats.dailyVisitors.length > 0 && (
                            <>
                                <h4 className={styles.flagDescription} style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                                    日別訪問者数
                                </h4>
                                <div className={styles.barChart}>
                                    {(() => {
                                        const maxCount = Math.max(...analytics.visitorStats.dailyVisitors.map(d => d.total), 1);
                                        return analytics.visitorStats.dailyVisitors.map(day => (
                                            <div key={day.date} className={styles.barGroup}>
                                                <div
                                                    className={styles.bar}
                                                    style={{ height: `${(day.total / maxCount) * 100}%` }}
                                                    title={`${day.date}: ${day.total}PV（認証: ${day.authenticated}, 匿名: ${day.anonymous}）`}
                                                />
                                                <span className={styles.barLabel}>
                                                    {day.date.slice(5)}
                                                </span>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </>
                        )}

                        {/* 人気ページ TOP 10 */}
                        {analytics.visitorStats.topPages.length > 0 && (
                            <>
                                <h4 className={styles.flagDescription} style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                                    人気ページ TOP 10
                                </h4>
                                <div className={styles.examTable}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>ページ</th>
                                                <th>ビュー数</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {analytics.visitorStats.topPages.map(page => (
                                                <tr key={page.path}>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{page.path}</td>
                                                    <td>{page.views.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* 日別アクティビティ */}
                        <h3 className={styles.sectionTitle} style={{ fontSize: '1rem', marginTop: '1.5rem' }}>
                            📈 日別アクティビティ
                        </h3>
                        {analytics.dailyActivity.length > 0 ? (
                            <div className={styles.barChart}>
                                {(() => {
                                    const maxCount = Math.max(...analytics.dailyActivity.map(d => d.count), 1);
                                    return analytics.dailyActivity.map(day => (
                                        <div key={day.date} className={styles.barGroup}>
                                            <div
                                                className={styles.bar}
                                                style={{ height: `${(day.count / maxCount) * 100}%` }}
                                                title={`${day.date}: ${day.count}件（正答: ${day.correctCount}件）`}
                                            />
                                            <span className={styles.barLabel}>
                                                {day.date.slice(5)}
                                            </span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        ) : (
                            <div className={styles.emptyData}>データがありません</div>
                        )}

                        {/* 試験別集計 */}
                        <h3 className={styles.sectionTitle} style={{ fontSize: '1rem', marginTop: '1.5rem' }}>
                            📋 試験別セッション集計
                        </h3>
                        {analytics.examBreakdown.length > 0 ? (
                            <div className={styles.examTable}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>試験ID</th>
                                            <th>セッション数</th>
                                            <th>完了数</th>
                                            <th>完了率</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.examBreakdown.map(exam => {
                                            const rate = exam.count > 0 ? (exam.completedCount / exam.count) * 100 : 0;
                                            return (
                                                <tr key={exam.examId}>
                                                    <td>{exam.examId}</td>
                                                    <td>{exam.count}</td>
                                                    <td>{exam.completedCount}</td>
                                                    <td>
                                                        <div className={styles.progressBar}>
                                                            <div
                                                                className={styles.progressFill}
                                                                style={{ width: `${rate}%` }}
                                                            />
                                                        </div>
                                                        {rate.toFixed(0)}%
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className={styles.emptyData}>データがありません</div>
                        )}

                        {/* 最近のユーザー */}
                        <h3 className={styles.sectionTitle} style={{ fontSize: '1rem', marginTop: '1.5rem' }}>
                            🆕 最近のユーザー
                        </h3>
                        {analytics.recentUsers.length > 0 ? (
                            <div className={styles.userTable}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>名前</th>
                                            <th>メール</th>
                                            <th>ロール</th>
                                            <th>登録日</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.recentUsers.map(user => (
                                            <tr key={user.id}>
                                                <td>{user.name || '(未設定)'}</td>
                                                <td>{user.email || '(なし)'}</td>
                                                <td>
                                                    <span className={`${styles.userRole} ${
                                                        user.role === 'admin' ? styles.roleAdmin :
                                                        user.isGuest ? styles.roleGuest :
                                                        styles.roleUser
                                                    }`}>
                                                        {user.role === 'admin' ? '管理者' :
                                                         user.isGuest ? 'ゲスト' : 'ユーザー'}
                                                    </span>
                                                </td>
                                                <td>{formatDate(user.createdAt)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className={styles.emptyData}>データがありません</div>
                        )}
                    </>
                ) : null}
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
