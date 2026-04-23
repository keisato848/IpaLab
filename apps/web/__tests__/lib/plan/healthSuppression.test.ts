import { describe, it, expect } from 'vitest';

import {
    nextSuppressionState,
    shouldShowToast,
    type PlanHealthSuppressionState,
} from '@/lib/plan/healthSuppression';

const NOW = new Date('2026-04-23T00:00:00.000Z');

describe('shouldShowToast', () => {
    it('suppression が無ければ表示', () => {
        expect(shouldShowToast('slight_delay', null, NOW)).toBe(true);
    });

    it('同一ヘルスで期限内は非表示', () => {
        const s: PlanHealthSuppressionState = {
            lastStatus: 'slight_delay',
            nextAllowedAt: '2026-04-25T00:00:00.000Z',
        };
        expect(shouldShowToast('slight_delay', s, NOW)).toBe(false);
    });

    it('同一ヘルスで期限後は表示', () => {
        const s: PlanHealthSuppressionState = {
            lastStatus: 'slight_delay',
            nextAllowedAt: '2026-04-22T00:00:00.000Z',
        };
        expect(shouldShowToast('slight_delay', s, NOW)).toBe(true);
    });

    it('ヘルスが悪化したらスロットリング無視', () => {
        const s: PlanHealthSuppressionState = {
            lastStatus: 'slight_delay',
            nextAllowedAt: '2026-04-30T00:00:00.000Z',
        };
        expect(shouldShowToast('major_delay', s, NOW)).toBe(true);
    });

    it('ヘルスが好転したら表示 (別カテゴリなので)', () => {
        const s: PlanHealthSuppressionState = {
            lastStatus: 'major_delay',
            nextAllowedAt: '2026-04-30T00:00:00.000Z',
        };
        expect(shouldShowToast('on_fire', s, NOW)).toBe(true);
    });
});

describe('nextSuppressionState', () => {
    it('apply はリセット (null)', () => {
        expect(nextSuppressionState('major_delay', 'apply', NOW)).toBeNull();
    });

    it('later は 3 日後まで', () => {
        const s = nextSuppressionState('slight_delay', 'later', NOW)!;
        expect(s.lastStatus).toBe('slight_delay');
        expect(new Date(s.nextAllowedAt).getTime() - NOW.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
    });

    it('close は 7 日後まで', () => {
        const s = nextSuppressionState('on_track', 'close', NOW)!;
        expect(new Date(s.nextAllowedAt).getTime() - NOW.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });
});
