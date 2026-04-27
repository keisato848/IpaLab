import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import { usePlanHealthCheck } from '@/hooks/usePlanHealthCheck';
import type { PerformanceProfile } from '@/lib/types/performanceProfile';

const NOW = '2026-04-23T00:00:00.000Z';

function buildProfile(overrides: Partial<PerformanceProfile> = {}): PerformanceProfile {
    return {
        userId: 'u1',
        paceByWeekday: [10, 1, 1, 1, 1, 1, 10],
        recentAchievementRate: 0.3, // major_delay
        consecutiveOnFireDays: 0,
        accuracyByCategory: {},
        continuityRate: 1,
        consecutiveStudyDays: 7,
        paceRatio: 1,
        generatedAt: NOW,
        ...overrides,
    };
}

describe('usePlanHealthCheck', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('API が { profile } を返す形式に対応し、major_delay でトーストを表示', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ profile: buildProfile() }),
        }) as unknown as typeof fetch;

        const { result } = renderHook(() => usePlanHealthCheck({ userId: 'u1' }));

        await waitFor(() => expect(result.current.health).not.toBeNull());
        expect(result.current.health?.status).toBe('major_delay');
        expect(result.current.visible).toBe(true);
    });

    it('on_track (順調) は visible にならない', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ profile: buildProfile({ recentAchievementRate: 0.9 }) }),
        }) as unknown as typeof fetch;

        const { result } = renderHook(() => usePlanHealthCheck({ userId: 'u1' }));

        await waitFor(() => expect(result.current.health).not.toBeNull());
        expect(result.current.health?.status).toBe('on_track');
        expect(result.current.visible).toBe(false);
    });

    it('suppression (期限内) があれば表示しない', async () => {
        // userId 別キーで保存
        window.localStorage.setItem(
            'planHealthSuppressionV1:u1',
            JSON.stringify({
                lastStatus: 'major_delay',
                nextAllowedAt: '2099-01-01T00:00:00.000Z',
            }),
        );
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ profile: buildProfile() }),
        }) as unknown as typeof fetch;

        const { result } = renderHook(() => usePlanHealthCheck({ userId: 'u1' }));

        await waitFor(() => expect(result.current.health).not.toBeNull());
        expect(result.current.visible).toBe(false);
    });

    it('dismiss(later) で suppression が userId 別キーに保存される', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ profile: buildProfile() }),
        }) as unknown as typeof fetch;

        const { result } = renderHook(() => usePlanHealthCheck({ userId: 'u1' }));

        await waitFor(() => expect(result.current.visible).toBe(true));
        act(() => result.current.dismiss('later'));

        const raw = window.localStorage.getItem('planHealthSuppressionV1:u1');
        expect(raw).not.toBeNull();
        const saved = JSON.parse(raw!);
        expect(saved.lastStatus).toBe('major_delay');
        expect(result.current.visible).toBe(false);
    });

    it('enabled=false なら fetch しない', async () => {
        const fetchSpy = vi.fn();
        global.fetch = fetchSpy as unknown as typeof fetch;

        renderHook(() => usePlanHealthCheck({ userId: 'u1', enabled: false }));
        // 1 tick 待つ
        await new Promise((r) => setTimeout(r, 0));
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('userId が空なら fetch しない', async () => {
        const fetchSpy = vi.fn();
        global.fetch = fetchSpy as unknown as typeof fetch;

        renderHook(() => usePlanHealthCheck({ userId: '' }));
        await new Promise((r) => setTimeout(r, 0));
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
