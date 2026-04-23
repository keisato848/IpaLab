'use client';

import { useCallback, useEffect, useState } from 'react';

import { evaluatePlanHealth } from '@/lib/plan/healthCheck';
import {
    loadSuppression,
    nextSuppressionState,
    saveSuppression,
    shouldShowToast,
    type DismissReason,
} from '@/lib/plan/healthSuppression';
import type { PerformanceProfile } from '@/lib/types/performanceProfile';
import type { PlanHealthResult } from '@/lib/types/planHealth';

interface UsePlanHealthCheckResult {
    health: PlanHealthResult | null;
    visible: boolean;
    loading: boolean;
    dismiss: (reason: DismissReason) => void;
}

/**
 * ダッシュボードマウント時に PerformanceProfile を取得し、
 * クライアント側で健康判定 + スロットリングを適用してトースト表示状態を返す。
 *
 * 健康判定はクライアント純粋関数で行うため API 往復は 1 回のみ (profile 取得)。
 */
export function usePlanHealthCheck(enabled: boolean = true): UsePlanHealthCheckResult {
    const [health, setHealth] = useState<PlanHealthResult | null>(null);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        let aborted = false;

        async function run() {
            setLoading(true);
            try {
                const res = await fetch('/api/profile/performance', { credentials: 'include' });
                if (!res.ok) return;
                const profile = (await res.json()) as PerformanceProfile;
                if (aborted) return;

                const result = evaluatePlanHealth(profile);
                setHealth(result);

                if (!result.shouldNotify) return;
                const suppression = loadSuppression();
                if (shouldShowToast(result.status, suppression, new Date())) {
                    setVisible(true);
                }
            } catch (e) {
                console.warn('[usePlanHealthCheck] failed', e);
            } finally {
                if (!aborted) setLoading(false);
            }
        }
        void run();
        return () => {
            aborted = true;
        };
    }, [enabled]);

    const dismiss = useCallback(
        (reason: DismissReason) => {
            setVisible(false);
            if (!health) return;
            const next = nextSuppressionState(health.status, reason, new Date());
            saveSuppression(next);
        },
        [health],
    );

    return { health, visible, loading, dismiss };
}
