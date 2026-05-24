// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { usePerformanceProfile } from '@/hooks/usePerformanceProfile';
import type { PerformanceProfile } from '@/lib/types/performanceProfile';

const NOW = '2026-04-23T00:00:00.000Z';

function buildProfile(): PerformanceProfile {
    return {
        userId: 'u1',
        paceByWeekday: [1, 1, 1, 1, 1, 1, 1],
        recentAchievementRate: 0.8,
        consecutiveOnFireDays: 0,
        accuracyByCategory: {},
        continuityRate: 1,
        consecutiveStudyDays: 5,
        paceRatio: 1,
        generatedAt: NOW,
    };
}

describe('usePerformanceProfile', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('レスポンスを { profile } として取り出して state にセットする', async () => {
        const profile = buildProfile();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ profile }),
        }) as unknown as typeof fetch;

        const { result } = renderHook(() => usePerformanceProfile(true));

        await waitFor(() => expect(result.current.profile).not.toBeNull());
        expect(result.current.profile?.paceRatio).toBe(1);
        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('!res.ok のとき error をセット', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({}),
        }) as unknown as typeof fetch;

        const { result } = renderHook(() => usePerformanceProfile(true));

        await waitFor(() => expect(result.current.error).not.toBeNull());
        expect(result.current.error).toContain('500');
        expect(result.current.profile).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('fetch reject のとき error をセット', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('net down')) as unknown as typeof fetch;

        const { result } = renderHook(() => usePerformanceProfile(true));

        await waitFor(() => expect(result.current.error).not.toBeNull());
        expect(result.current.error).toBe('net down');
        expect(result.current.loading).toBe(false);
    });

    it('enabled=false なら fetch しない', async () => {
        const fetchSpy = vi.fn();
        global.fetch = fetchSpy as unknown as typeof fetch;

        const { result } = renderHook(() => usePerformanceProfile(false));
        await new Promise((r) => setTimeout(r, 0));
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
    });
});
