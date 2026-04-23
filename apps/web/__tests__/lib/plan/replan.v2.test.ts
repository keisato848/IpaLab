import { describe, it, expect } from 'vitest';

import { replan } from '@/lib/plan/replan';
import type { StudyPlan } from '@/lib/api';
import type { DailyProgress } from '@ipa-lab/shared';
import type { PerformanceProfile } from '@/lib/types/performanceProfile';

const NOW = '2026-04-23T00:00:00.000Z';
const now = () => NOW;

const dp = (date: string, questionCount: number): DailyProgress => ({
    id: `u1-${date}`,
    userId: 'u1',
    date,
    questionCount,
    correctCount: questionCount,
    accuracy: 100,
    totalTimeSeconds: 60 * questionCount,
    sessionCount: 1,
    examBreakdown: {},
    status: 'completed',
    aggregatedAt: NOW,
});

function buildPlanWithCategories(
    days: { date: string; questionCount: number; targetCategory?: string }[],
    examDate = '2026-05-15',
): StudyPlan {
    return {
        title: 'test plan',
        examDate,
        monthlyGoal: 'goal',
        weeklySchedule: [
            {
                weekNumber: 1,
                startDate: days[0]?.date ?? '2026-04-15',
                endDate: days[days.length - 1]?.date ?? '2026-04-30',
                goal: 'w1',
                dailyTasks: days.map((d) => ({
                    date: d.date,
                    goal: 'g',
                    questionCount: d.questionCount,
                    targetCategory: d.targetCategory,
                })),
            },
        ],
        generatedAt: NOW,
    };
}

function profile(overrides: Partial<PerformanceProfile> = {}): PerformanceProfile {
    return {
        userId: 'u1',
        windowDays: 28,
        // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
        paceByWeekday: [10, 1, 1, 1, 1, 1, 10],
        recentAchievementRate: 1,
        consecutiveOnFireDays: 0,
        accuracyByCategory: [],
        continuityRate: 1,
        consecutiveStudyDays: 7,
        paceRatio: 1,
        generatedAt: NOW,
        ...overrides,
    };
}

describe('replan v2.0 (profile-weighted)', () => {
    it('algorithmVersion = 2.0 when profile is provided', () => {
        const plan = buildPlanWithCategories([
            { date: '2026-04-22', questionCount: 5 },
            { date: '2026-04-23', questionCount: 5 },
            { date: '2026-04-24', questionCount: 5 },
        ]);
        const result = replan({
            plan,
            dailyProgress: [dp('2026-04-22', 0)],
            today: '2026-04-23',
            profile: profile(),
            options: { now },
        });
        expect(result.algorithmVersion).toBe('2.0');
    });

    it('曜日ペース重みが大きい曜日に優先的に詰める', () => {
        // 2026-04-25 = 土曜 (Sat, dow=6, weight 10)
        // 2026-04-24 = 金曜 (Fri, dow=5, weight 1)
        // 2026-04-26 = 日曜 (Sun, dow=0, weight 10)
        const plan = buildPlanWithCategories([
            { date: '2026-04-22', questionCount: 8 },
            { date: '2026-04-24', questionCount: 5 },
            { date: '2026-04-25', questionCount: 5 },
            { date: '2026-04-26', questionCount: 5 },
        ]);
        const result = replan({
            plan,
            dailyProgress: [dp('2026-04-22', 0)],
            today: '2026-04-23',
            profile: profile(),
            options: { now, capacityBoost: 2, baseCapacity: 5 },
        });
        const tasks = result.plan.weeklySchedule[0].dailyTasks;
        const fri = tasks.find((t) => t.date === '2026-04-24')!.questionCount;
        const sat = tasks.find((t) => t.date === '2026-04-25')!.questionCount;
        const sun = tasks.find((t) => t.date === '2026-04-26')!.questionCount;
        // debt=8: 高ペース曜日 sat (cap 10, room 5) → 5 取り、残り 3 → sun へ → sat=10, sun=8
        // 金 (低ペース) は手付かず → 5
        expect(sat).toBe(10);
        expect(sun).toBe(8);
        expect(fri).toBe(5);
    });

    it('弱点カテゴリに優先的に詰める', () => {
        const plan = buildPlanWithCategories([
            { date: '2026-04-22', questionCount: 5 },
            { date: '2026-04-24', questionCount: 5, targetCategory: 'NW' },
            { date: '2026-04-25', questionCount: 5, targetCategory: 'DB' },
        ]);
        const result = replan({
            plan,
            dailyProgress: [dp('2026-04-22', 0)],
            today: '2026-04-23',
            profile: profile({
                paceByWeekday: [1, 1, 1, 1, 1, 1, 1], // 曜日重み均等
                accuracyByCategory: [
                    { category: 'NW', accuracy: 0.5, totalCount: 100 },
                    { category: 'DB', accuracy: 0.9, totalCount: 100 },
                ],
            }),
            options: { now, capacityBoost: 2, baseCapacity: 5 },
        });
        const tasks = result.plan.weeklySchedule[0].dailyTasks;
        const nw = tasks.find((t) => t.date === '2026-04-24')!.questionCount;
        const db = tasks.find((t) => t.date === '2026-04-25')!.questionCount;
        // 弱点 NW のほうに詰まる
        expect(nw).toBeGreaterThan(db);
    });

    it('profile 無しなら v1.0 と同じ (日付昇順)', () => {
        const plan = buildPlanWithCategories([
            { date: '2026-04-22', questionCount: 5 },
            { date: '2026-04-24', questionCount: 5 },
            { date: '2026-04-25', questionCount: 5 },
        ]);
        const result = replan({
            plan,
            dailyProgress: [dp('2026-04-22', 0)],
            today: '2026-04-23',
            options: { now },
        });
        expect(result.algorithmVersion).toBe('1.0');
    });

    it('paceByWeekday が全 0 でも例外なく動く (重み均等)', () => {
        const plan = buildPlanWithCategories([
            { date: '2026-04-22', questionCount: 5 },
            { date: '2026-04-24', questionCount: 5 },
        ]);
        const result = replan({
            plan,
            dailyProgress: [dp('2026-04-22', 0)],
            today: '2026-04-23',
            profile: profile({ paceByWeekday: [0, 0, 0, 0, 0, 0, 0] }),
            options: { now },
        });
        expect(result.algorithmVersion).toBe('2.0');
        expect(result.diff.totalDebtQuestions).toBe(5);
    });
});
