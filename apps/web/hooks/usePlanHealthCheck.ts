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
    /**
     * 外部で取得済みの profile を注入できる。指定された場合は API fetch をスキップし、
     * 渡された profile に対してのみ評価する。これによりダッシュボード上で
     * `usePerformanceProfile` (#219) と本フックが API を二重呼び出しする問題を回避する。
     */
    profile?: PerformanceProfile | null;
}

/**
 * ダッシュボードマウント時に PerformanceProfile を取得し、
 * クライアント側で健康判定 + スロットリングを適用してトースト表示状態を返す。
 *
 * 健康判定はクライアント純粋関数で行うため、API 往復は profile が外部注入されない場合のみ 1 回。
 */
export function usePlanHealthCheck({
    userId,
    enabled = true,
    profile: externalProfile,
}: UsePlanHealthCheckOptions): UsePlanHealthCheckResult {
    const [health, setHealth] = useState<PlanHealthResult | null>(null);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !userId) return;

        // 外部から profile を渡された場合: API fetch せずそのまま評価
        if (externalProfile !== undefined) {
            if (externalProfile === null) return; // 取得待ち or 失敗
            const result = evaluatePlanHealth(externalProfile);
            setHealth(result);
            if (!result.shouldNotify) return;
            const suppression = loadSuppression(userId);
            if (shouldShowToast(result.status, suppression, new Date())) {
                setVisible(true);
            }
            return;
        }

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
    }, [enabled, userId, externalProfile]);

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
