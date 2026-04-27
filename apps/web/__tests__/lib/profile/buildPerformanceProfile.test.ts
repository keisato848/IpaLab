import { describe, it, expect } from 'vitest';
import {
    buildPerformanceProfile,
    calcPaceByWeekday,
    calcRecentAchievement,
    calcAccuracyByCategory,
    calcContinuity,
    calcPaceRatio,
} from '@/lib/profile/buildPerformanceProfile';
import type { DailyProgress, LearningRecord } from '@ipa-lab/shared';
import type { StudyPlan } from '@/lib/types/studyPlan';

const FIXED_NOW = '2026-04-23T00:00:00.000Z';
const TODAY = '2026-04-23'; // 2026-04-23 = Thursday (UTC)

function dp(date: string, q: number, c = 0): DailyProgress {
    return {
        id: `u1-${date}`,
        userId: 'u1',
        date,
        questionCount: q,
        correctCount: c,
        accuracy: q > 0 ? (c / q) * 100 : 0,
        totalTimeSeconds: 0,
        sessionCount: 1,
        examBreakdown: {},
        status: q > 0 ? 'completed' : 'none',
        aggregatedAt: FIXED_NOW,
    };
}

function lr(date: string, category: string, isCorrect: boolean): LearningRecord {
    return {
        id: '00000000-0000-0000-0000-000000000000',
        userId: 'u1',
        questionId: 'q1',
        examId: 'AP-2025S',
        category,
        isCorrect,
        isFlagged: false,
        answeredAt: `${date}T10:00:00.000Z`,
        timeTakenSeconds: 60,
        reviewInterval: 0,
        easeFactor: 2.5,
    };
}

describe('calcPaceByWeekday', () => {
    it('returns 0 array when no records', () => {
        expect(calcPaceByWeekday([])).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it('averages questionCount by UTC weekday, ignoring 0-day records', () => {
        // 2026-04-20 = Mon (1), 2026-04-21 = Tue (2), 2026-04-27 = Mon (1)
        const res = calcPaceByWeekday([
            dp('2026-04-20', 10),
            dp('2026-04-27', 20),
            dp('2026-04-21', 5),
            dp('2026-04-22', 0), // ignored (0)
        ]);
        expect(res[1]).toBe(15); // Mon avg
        expect(res[2]).toBe(5); // Tue
        expect(res[3]).toBe(0); // Wed (no data)
    });
});

describe('calcRecentAchievement', () => {
    it('returns 0 when no planned', () => {
        const res = calcRecentAchievement([dp('2026-04-22', 5)], {}, TODAY);
        expect(res.rate).toBe(0);
        expect(res.consecutiveOnFireDays).toBe(0);
    });

    it('computes overall rate over 7-day window', () => {
        const planned: Record<string, number> = {};
        for (let i = 0; i < 7; i += 1) {
            const date = new Date(`${TODAY}T00:00:00Z`);
            date.setUTCDate(date.getUTCDate() - i);
            planned[date.toISOString().slice(0, 10)] = 10;
        }
        const progresses = Object.keys(planned).map((d) => dp(d, 5));
        const res = calcRecentAchievement(progresses, planned, TODAY);
        expect(res.rate).toBeCloseTo(0.5);
        expect(res.consecutiveOnFireDays).toBe(0);
    });

    it('counts consecutive on_fire days from today backward', () => {
        const planned: Record<string, number> = {};
        const dates: string[] = [];
        for (let i = 0; i < 7; i += 1) {
            const d = new Date(`${TODAY}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() - i);
            const key = d.toISOString().slice(0, 10);
            dates.push(key);
            planned[key] = 10;
        }
        // today, today-1, today-2 are on fire (>130%); today-3 is not
        const progresses = [
            dp(dates[0], 14),
            dp(dates[1], 14),
            dp(dates[2], 14),
            dp(dates[3], 5),
            dp(dates[4], 14),
        ];
        const res = calcRecentAchievement(progresses, planned, TODAY);
        expect(res.consecutiveOnFireDays).toBe(3);
    });
});

describe('calcAccuracyByCategory', () => {
    it('aggregates by category', () => {
        const records = [
            lr('2026-04-22', 'cat-A', true),
            lr('2026-04-22', 'cat-A', false),
            lr('2026-04-22', 'cat-B', true),
            lr('2026-04-22', 'cat-B', true),
        ];
        const res = calcAccuracyByCategory(records);
        expect(res['cat-A']).toEqual({ total: 2, correct: 1, rate: 0.5 });
        expect(res['cat-B']).toEqual({ total: 2, correct: 2, rate: 1 });
    });
});

describe('calcContinuity', () => {
    it('counts study days and consecutive streak', () => {
        // today, today-1, today-2 studied, today-3 skipped, today-4 studied
        const dates: string[] = [];
        for (let i = 0; i < 5; i += 1) {
            const d = new Date(`${TODAY}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() - i);
            dates.push(d.toISOString().slice(0, 10));
        }
        const progresses = [
            dp(dates[0], 5),
            dp(dates[1], 5),
            dp(dates[2], 5),
            dp(dates[3], 0), // skipped
            dp(dates[4], 5),
        ];
        const res = calcContinuity(progresses, TODAY);
        expect(res.consecutiveStudyDays).toBe(3);
        expect(res.continuityRate).toBeCloseTo(4 / 28);
    });
});

describe('calcPaceRatio', () => {
    it('returns 1.0 when previous window has 0', () => {
        expect(calcPaceRatio([dp('2026-04-22', 5)], TODAY)).toBe(1);
    });

    it('returns recent/previous ratio', () => {
        const dates7: string[] = [];
        const dates14: string[] = [];
        for (let i = 0; i < 7; i += 1) {
            const d = new Date(`${TODAY}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() - i);
            dates7.push(d.toISOString().slice(0, 10));
        }
        for (let i = 7; i < 14; i += 1) {
            const d = new Date(`${TODAY}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() - i);
            dates14.push(d.toISOString().slice(0, 10));
        }
        const progresses = [
            ...dates7.map((d) => dp(d, 10)), // 70 total
            ...dates14.map((d) => dp(d, 5)), // 35 total
        ];
        expect(calcPaceRatio(progresses, TODAY)).toBeCloseTo(2);
    });
});

describe('buildPerformanceProfile', () => {
    it('builds full profile from inputs', () => {
        const plan: StudyPlan = {
            id: 'plan-1',
            title: 'AP',
            examDate: '2026-10-19',
            monthlyGoal: 'g',
            generatedAt: FIXED_NOW,
            weeklySchedule: [
                {
                    weekNumber: 1,
                    startDate: '2026-04-17',
                    endDate: '2026-04-23',
                    goal: 'w1',
                    dailyTasks: [
                        { date: '2026-04-23', goal: 't', questionCount: 10 },
                        { date: '2026-04-22', goal: 't', questionCount: 10 },
                    ],
                },
            ],
        };
        const profile = buildPerformanceProfile({
            userId: 'u1',
            dailyProgresses: [dp('2026-04-23', 5, 3), dp('2026-04-22', 8, 6)],
            records: [
                lr('2026-04-23', 'cat-A', true),
                lr('2026-04-23', 'cat-A', false),
                lr('2026-04-22', 'cat-B', true),
            ],
            plan,
            today: TODAY,
            now: () => FIXED_NOW,
        });
        expect(profile.userId).toBe('u1');
        expect(profile.generatedAt).toBe(FIXED_NOW);
        expect(profile.paceByWeekday.length).toBe(7);
        expect(profile.recentAchievementRate).toBeCloseTo((5 + 8) / (10 + 10));
        expect(profile.accuracyByCategory['cat-A'].rate).toBeCloseTo(0.5);
        expect(profile.continuityRate).toBeCloseTo(2 / 28);
        expect(profile.paceRatio).toBe(1); // no prev window data
    });

    it('handles empty inputs', () => {
        const profile = buildPerformanceProfile({
            userId: 'u1',
            dailyProgresses: [],
            records: [],
            today: TODAY,
            now: () => FIXED_NOW,
        });
        expect(profile.recentAchievementRate).toBe(0);
        expect(profile.continuityRate).toBe(0);
        expect(profile.consecutiveStudyDays).toBe(0);
        expect(profile.paceRatio).toBe(1);
        expect(profile.accuracyByCategory).toEqual({});
    });

    it('filters out records older than 28 days', () => {
        const oldDate = '2025-01-01'; // way older
        const profile = buildPerformanceProfile({
            userId: 'u1',
            dailyProgresses: [dp(oldDate, 100), dp(TODAY, 5)],
            records: [lr(oldDate, 'cat-A', true), lr(TODAY, 'cat-B', true)],
            today: TODAY,
            now: () => FIXED_NOW,
        });
        // old records filtered: only cat-B remains
        expect(profile.accuracyByCategory['cat-A']).toBeUndefined();
        expect(profile.accuracyByCategory['cat-B']).toBeDefined();
    });
});
