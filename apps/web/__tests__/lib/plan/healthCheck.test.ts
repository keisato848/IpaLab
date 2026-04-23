import { describe, it, expect } from 'vitest';

import { evaluatePlanHealth } from '@/lib/plan/healthCheck';
import type { PerformanceProfile } from '@/lib/types/performanceProfile';

const NOW = '2026-04-23T00:00:00.000Z';

function profile(overrides: Partial<PerformanceProfile> = {}): PerformanceProfile {
    return {
        userId: 'u1',
        paceByWeekday: [0, 0, 0, 0, 0, 0, 0],
        recentAchievementRate: 1.0,
        consecutiveOnFireDays: 0,
        accuracyByCategory: {},
        continuityRate: 0,
        consecutiveStudyDays: 0,
        paceRatio: 1,
        generatedAt: NOW,
        ...overrides,
    };
}

describe('evaluatePlanHealth', () => {
    const opts = { now: () => NOW };

    it('🟢 on_track: 達成率 70% 以上で notify=false', () => {
        const result = evaluatePlanHealth(profile({ recentAchievementRate: 0.85 }), opts);
        expect(result.status).toBe('on_track');
        expect(result.shouldNotify).toBe(false);
        expect(result.suggestion.kind).toBe('none');
        expect(result.suggestion.action).toBeNull();
    });

    it('🟢 on_track: ちょうど 70% は on_track', () => {
        expect(evaluatePlanHealth(profile({ recentAchievementRate: 0.7 }), opts).status).toBe(
            'on_track',
        );
    });

    it('🟡 slight_delay: 40-70% で replan_recommended', () => {
        const result = evaluatePlanHealth(profile({ recentAchievementRate: 0.5 }), opts);
        expect(result.status).toBe('slight_delay');
        expect(result.shouldNotify).toBe(true);
        expect(result.suggestion.kind).toBe('replan_recommended');
        expect(result.suggestion.action).toBe('open_replan');
    });

    it('🔴 major_delay: 40% 未満で replan_recommended', () => {
        const result = evaluatePlanHealth(profile({ recentAchievementRate: 0.2 }), opts);
        expect(result.status).toBe('major_delay');
        expect(result.shouldNotify).toBe(true);
        expect(result.suggestion.kind).toBe('replan_recommended');
    });

    it('🚀 on_fire: 達成率>1.3 かつ 連続3日で celebrate', () => {
        const result = evaluatePlanHealth(
            profile({ recentAchievementRate: 1.5, consecutiveOnFireDays: 3 }),
            opts,
        );
        expect(result.status).toBe('on_fire');
        expect(result.shouldNotify).toBe(true);
        expect(result.suggestion.kind).toBe('celebrate_and_boost');
        expect(result.suggestion.action).toBe('increase_pace');
    });

    it('on_fire 条件未達 (連続2日) は on_track 扱い', () => {
        const result = evaluatePlanHealth(
            profile({ recentAchievementRate: 1.5, consecutiveOnFireDays: 2 }),
            opts,
        );
        expect(result.status).toBe('on_track');
    });

    it('達成率 0 は major_delay', () => {
        expect(
            evaluatePlanHealth(profile({ recentAchievementRate: 0 }), opts).status,
        ).toBe('major_delay');
    });

    it('evaluatedAt は now() の戻り値', () => {
        expect(evaluatePlanHealth(profile(), opts).evaluatedAt).toBe(NOW);
    });

    it('不正値 (NaN/Infinity/負数) は防御的に補正される', () => {
        const r1 = evaluatePlanHealth(profile({ recentAchievementRate: Number.NaN }), opts);
        expect(r1.achievementRate).toBe(0);
        expect(r1.status).toBe('major_delay');

        const r2 = evaluatePlanHealth(
            profile({ recentAchievementRate: Number.POSITIVE_INFINITY }),
            opts,
        );
        expect(r2.achievementRate).toBe(0);

        const r3 = evaluatePlanHealth(
            profile({ recentAchievementRate: 1.5, consecutiveOnFireDays: Number.NaN }),
            opts,
        );
        expect(r3.consecutiveOnFireDays).toBe(0);
        expect(r3.status).toBe('on_track');
    });
});
