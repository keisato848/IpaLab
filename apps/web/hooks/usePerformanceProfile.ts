'use client';

import { useEffect, useState } from 'react';

import type { PerformanceProfile } from '@/lib/types/performanceProfile';

interface UsePerformanceProfileResult {
    profile: PerformanceProfile | null;
    loading: boolean;
    error: string | null;
}

/**
 * GET /api/profile/performance を取得するシンプルフック。
 * 可視化UI (#219) とヘルスチェック (#221) の両方から利用される想定だが、
 * **DashboardClient で 1 回だけ呼び出し、結果を子コンポーネントに props として配る**
 * ことで API 二重呼び出しを避ける運用とする (#228 PR レビュー対応)。
 */
export function usePerformanceProfile(enabled: boolean = true): UsePerformanceProfileResult {
    const [profile, setProfile] = useState<PerformanceProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            // disabled に切り替わったら state をリセット (loading=true 残留対策)
            setLoading(false);
            setError(null);
            return;
        }
        let aborted = false;

        async function run() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/profile/performance', { credentials: 'include' });
                if (!res.ok) {
                    // body の message を取り出してエラー詳細に含める (診断性向上)
                    let detail = '';
                    try {
                        const body = (await res.json()) as { message?: string; error?: string };
                        detail = body.message ?? body.error ?? '';
                    } catch {
                        // body が JSON でない場合は無視
                    }
                    if (!aborted) {
                        setError(detail ? `status ${res.status}: ${detail}` : `status ${res.status}`);
                    }
                    return;
                }
                const json = (await res.json()) as { profile: PerformanceProfile };
                if (!aborted) setProfile(json.profile);
            } catch (e) {
                if (!aborted) setError(e instanceof Error ? e.message : 'unknown');
            } finally {
                // aborted でも loading=true で残らないよう必ずリセット
                setLoading(false);
            }
        }
        void run();
        return () => {
            aborted = true;
        };
    }, [enabled]);

    return { profile, loading, error };
}
