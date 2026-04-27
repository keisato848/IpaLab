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

interface UsePlanHealthCheckOptions {
    /** localStorage キーをユーザ別にスコープするための userId */
    userId: string;
    /** disabled なら fetch しない (default true) */
    enabled?: boolean;
}

/**
 * ダッシュボードマウント時に PerformanceProfile を取得し、
 * クライアント側で健康判定 + スロットリングを適用してトースト表示状態を返す。
 *
 * 健康判定はクライアント純粋関数で行うため API 往復は 1 回のみ (profile 取得)。
 */
export function usePlanHealthCheck({
    userId,
    enabled = true,
}: UsePlanHealthCheckOptions): UsePlanHealthCheckResult {
    const [health, setHealth] = useState<PlanHealthResult | null>(null);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !userId) return;
        let aborted = false;

        async function run() {
            setLoading(true);
            try {
                const res = await fetch('/api/profile/performance', { credentials: 'include' });
                if (!res.ok) return;
                const json = (await res.json()) as { profile: PerformanceProfile };
                if (aborted) return;

                const result = evaluatePlanHealth(json.profile);
                setHealth(result);

                if (!result.shouldNotify) return;
                const suppression = loadSuppression(userId);
                if (shouldShowToast(result.status, suppression, new Date())) {
                    setVisible(true);
                }
            } catch (e) {
                console.warn('[usePlanHealthCheck] failed', e);
            } finally {
                setLoading(false);
            }
        }
        void run();
        return () => {
            aborted = true;
        };
    }, [enabled, userId]);

    const dismiss = useCallback(
        (reason: DismissReason) => {
            setVisible(false);
            if (!health || !userId) return;
            const next = nextSuppressionState(health.status, reason, new Date());
            saveSuppression(userId, next);
        },
        [health, userId],
    );

    return { health, visible, loading, dismiss };
}
