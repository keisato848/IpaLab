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
 * 可視化UI (#219) とヘルスチェック (#221) の両方から利用される想定。
 */
export function usePerformanceProfile(enabled: boolean = true): UsePerformanceProfileResult {
    const [profile, setProfile] = useState<PerformanceProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) return;
        let aborted = false;

        async function run() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/profile/performance', { credentials: 'include' });
                if (!res.ok) {
                    if (!aborted) setError(`status ${res.status}`);
                    return;
                }
                const data = (await res.json()) as PerformanceProfile;
                if (!aborted) setProfile(data);
            } catch (e) {
                if (!aborted) setError(e instanceof Error ? e.message : 'unknown');
            } finally {
                if (!aborted) setLoading(false);
            }
        }
        void run();
        return () => {
            aborted = true;
        };
    }, [enabled]);

    return { profile, loading, error };
}
