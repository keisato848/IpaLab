import { describe, it, expect } from 'vitest';
import { replan } from '@/lib/plan/replan';
import type { StudyPlan } from '@/lib/api';
import type { DailyProgress } from '@ipa-lab/shared';

const NOW = '2026-04-21T00:00:00.000Z';
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

const buildPlan = (
    days: { date: string; questionCount: number }[],
    examDate = '2026-05-01',
): StudyPlan => ({
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
            })),
        },
    ],
    generatedAt: NOW,
});

describe('replan', () => {
    it('no changes when there is no past debt', () => {
        const plan = buildPlan([
            { date: '2026-04-21', questionCount: 5 },
            { date: '2026-04-22', questionCount: 5 },
        ]);
        const r = replan({ plan, dailyProgress: [], today: '2026-04-21', options: { now } });
        expect(r.diff.totalDebtQuestions).toBe(0);
        expect(r.diff.moved).toEqual([]);
        expect(r.plan.weeklySchedule[0].dailyTasks[0].questionCount).toBe(5);
        expect(r.plan.weeklySchedule[0].dailyTasks[1].questionCount).toBe(5);
    });

    it('redistributes unfulfilled past tasks into future days', () => {
        const plan = buildPlan([
            { date: '2026-04-19', questionCount: 10 },
            { date: '2026-04-20', questionCount: 10 },
            { date: '2026-04-22', questionCount: 5 },
            { date: '2026-04-23', questionCount: 5 },
        ]);
        const dailyProgress = [dp('2026-04-19', 4), dp('2026-04-20', 0)];
        // debt = 6 + 10 = 16
        const r = replan({ plan, dailyProgress, today: '2026-04-21', options: { now } });
        expect(r.diff.totalDebtQuestions).toBe(16);
        // capacity per day: max(baseCap=5, ceil(5*1.5)=8) = 8 → room = 8-5 = 3 per day → 6 total
        // actually 2 future days * 3 = 6 redistributed; remainder 10 overflows
        const counts = r.plan.weeklySchedule[0].dailyTasks.map((t) => t.questionCount);
        // past days unchanged in shape (we don't rewrite past)
        expect(counts[0]).toBe(10);
        expect(counts[1]).toBe(10);
        expect(counts[2]).toBe(8);
        expect(counts[3]).toBe(8);
        expect(r.diff.redistributedQuestions).toBe(6);
        expect(r.diff.overflowed.length).toBeGreaterThan(0);
        expect(r.warnings.some((w) => w.includes('試験日までに収まらない'))).toBe(true);
    });

    it('treats partially completed past day correctly', () => {
        const plan = buildPlan([
            { date: '2026-04-20', questionCount: 10 },
            { date: '2026-04-22', questionCount: 5 },
        ]);
        const r = replan({
            plan,
            dailyProgress: [dp('2026-04-20', 7)],
            today: '2026-04-21',
            options: { now },
        });
        expect(r.diff.totalDebtQuestions).toBe(3);
        expect(r.plan.weeklySchedule[0].dailyTasks[1].questionCount).toBe(8);
        expect(r.diff.redistributedQuestions).toBe(3);
    });

    it('does not assign tasks beyond examDate', () => {
        const plan = buildPlan(
            [
                { date: '2026-04-19', questionCount: 100 },
                { date: '2026-04-22', questionCount: 5 },
                { date: '2026-05-02', questionCount: 5 }, // beyond exam
            ],
            '2026-05-01',
        );
        const r = replan({
            plan,
            dailyProgress: [dp('2026-04-19', 0)],
            today: '2026-04-21',
            options: { now },
        });
        // future days within examDate: only 2026-04-22, capacity = max(5, ceil(5*1.5)) = 8 → room 3
        expect(r.plan.weeklySchedule[0].dailyTasks[1].questionCount).toBe(8);
        expect(r.plan.weeklySchedule[0].dailyTasks[2].questionCount).toBe(5); // unchanged
        expect(r.diff.overflowed[0].questionCount).toBe(97);
    });

    it('overflows when there are no future days at all', () => {
        const plan = buildPlan(
            [
                { date: '2026-04-19', questionCount: 10 },
                { date: '2026-04-20', questionCount: 10 },
            ],
            '2026-04-20',
        );
        const r = replan({
            plan,
            dailyProgress: [dp('2026-04-19', 0), dp('2026-04-20', 0)],
            today: '2026-04-21',
            options: { now },
        });
        expect(r.diff.totalDebtQuestions).toBe(20);
        expect(r.diff.redistributedQuestions).toBe(0);
        expect(r.diff.overflowed.every((o) => o.reason === 'past_exam_date')).toBe(true);
        expect(r.warnings.some((w) => w.includes('未来日が存在しない'))).toBe(true);
    });

    it('respects baseCapacity when planned questionCount is 0', () => {
        const plan = buildPlan([
            { date: '2026-04-20', questionCount: 5 },
            { date: '2026-04-22', questionCount: 0 }, // rest day
        ]);
        const r = replan({
            plan,
            dailyProgress: [dp('2026-04-20', 0)],
            today: '2026-04-21',
            options: { now },
        });
        // rest day baseCapacity = 5 → all 5 fit
        expect(r.plan.weeklySchedule[0].dailyTasks[1].questionCount).toBe(5);
        expect(r.diff.redistributedQuestions).toBe(5);
    });

    it('returns immutable copy (does not mutate input)', () => {
        const plan = buildPlan([
            { date: '2026-04-20', questionCount: 10 },
            { date: '2026-04-22', questionCount: 5 },
        ]);
        const before = JSON.stringify(plan);
        replan({ plan, dailyProgress: [dp('2026-04-20', 0)], today: '2026-04-21', options: { now } });
        expect(JSON.stringify(plan)).toBe(before);
    });

    it('produces moved entries with carry_forward reason', () => {
        const plan = buildPlan([
            { date: '2026-04-20', questionCount: 5 },
            { date: '2026-04-22', questionCount: 5 },
        ]);
        const r = replan({
            plan,
            dailyProgress: [dp('2026-04-20', 0)],
            today: '2026-04-21',
            options: { now },
        });
        expect(r.diff.moved).toHaveLength(1);
        expect(r.diff.moved[0]).toMatchObject({
            fromDate: '2026-04-20',
            toDate: '2026-04-22',
            reason: 'unfulfilled_carry_forward',
        });
    });

    it('completionThreshold < 1 reduces required count', () => {
        const plan = buildPlan([
            { date: '2026-04-20', questionCount: 10 },
            { date: '2026-04-22', questionCount: 5 },
        ]);
        const r = replan({
            plan,
            dailyProgress: [dp('2026-04-20', 8)],
            today: '2026-04-21',
            options: { now, completionThreshold: 0.8 }, // required=8 → debt=0
        });
        expect(r.diff.totalDebtQuestions).toBe(0);
        expect(r.plan.weeklySchedule[0].dailyTasks[1].questionCount).toBe(5);
    });

    it('does not throw when a week has undefined dailyTasks (regression: defense-in-depth for #189)', () => {
        const plan = buildPlan([
            { date: '2026-04-21', questionCount: 5 },
            { date: '2026-04-22', questionCount: 5 },
        ]);
        // 未生成週を末尾に追加（dailyTasks 欠落）
        plan.weeklySchedule.push({
            weekNumber: 2,
            startDate: '2026-04-28',
            endDate: '2026-05-04',
            goal: 'transition week (not yet generated)',
        } as unknown as (typeof plan.weeklySchedule)[number]);

        expect(() => replan({ plan, dailyProgress: [], today: '2026-04-21', options: { now } })).not.toThrow();
        const r = replan({ plan, dailyProgress: [], today: '2026-04-21', options: { now } });
        expect(r.plan.weeklySchedule[1].dailyTasks).toEqual([]);
    });
});
