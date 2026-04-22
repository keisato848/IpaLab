import { describe, it, expect } from 'vitest';
import { replan } from '@/lib/plan/replan';
import type { StudyPlan } from '@/lib/api';

const NOW = '2026-04-21T00:00:00.000Z';
const now = () => NOW;

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

describe('replan v1.5: manualMoves', () => {
    it('manualMoves で from の問題数を to に転送し、from は 0 になる', () => {
        const plan = buildPlan([
            { date: '2026-04-22', questionCount: 10 },
            { date: '2026-04-23', questionCount: 5 },
        ]);
        const r = replan({
            plan,
            dailyProgress: [],
            today: '2026-04-21',
            manualMoves: [{ fromDate: '2026-04-22', toDate: '2026-04-23' }],
            options: { now },
        });
        expect(r.algorithmVersion).toBe('1.5');
        expect(r.diff.manualMovesApplied).toBe(1);
        expect(r.plan.weeklySchedule[0].dailyTasks[0].questionCount).toBe(0);
        expect(r.plan.weeklySchedule[0].dailyTasks[1].questionCount).toBe(15);
        const move = r.diff.moved.find((m) => m.reason === 'manual_move');
        expect(move).toEqual({
            fromDate: '2026-04-22',
            toDate: '2026-04-23',
            questionCount: 10,
            reason: 'manual_move',
        });
    });

    it('manualMoves が空配列なら v1.0 と同じ挙動', () => {
        const plan = buildPlan([
            { date: '2026-04-22', questionCount: 5 },
            { date: '2026-04-23', questionCount: 5 },
        ]);
        const r = replan({
            plan,
            dailyProgress: [],
            today: '2026-04-21',
            manualMoves: [],
            options: { now },
        });
        expect(r.algorithmVersion).toBe('1.0');
        expect(r.diff.manualMovesApplied).toBe(0);
    });

    it('過去日への移動は overflowed に記録される', () => {
        const plan = buildPlan([
            { date: '2026-04-22', questionCount: 10 },
            { date: '2026-04-23', questionCount: 5 },
        ]);
        const r = replan({
            plan,
            dailyProgress: [],
            today: '2026-04-21',
            manualMoves: [{ fromDate: '2026-04-22', toDate: '2026-04-19' }],
            options: { now },
        });
        const inv = r.diff.overflowed.find((o) => o.reason === 'manual_move_invalid');
        expect(inv).toBeDefined();
        expect(inv?.questionCount).toBe(10);
    });

    it('複数 manualMoves を順次適用できる', () => {
        const plan = buildPlan([
            { date: '2026-04-22', questionCount: 10 },
            { date: '2026-04-23', questionCount: 5 },
            { date: '2026-04-24', questionCount: 5 },
        ]);
        const r = replan({
            plan,
            dailyProgress: [],
            today: '2026-04-21',
            manualMoves: [
                { fromDate: '2026-04-22', toDate: '2026-04-24' },
                { fromDate: '2026-04-23', toDate: '2026-04-24' },
            ],
            options: { now },
        });
        expect(r.diff.manualMovesApplied).toBe(2);
        expect(r.plan.weeklySchedule[0].dailyTasks[0].questionCount).toBe(0);
        expect(r.plan.weeklySchedule[0].dailyTasks[1].questionCount).toBe(0);
        expect(r.plan.weeklySchedule[0].dailyTasks[2].questionCount).toBe(20);
    });

    it('manualMoves の後で過去 debt も再配分される (combined)', () => {
        const plan = buildPlan([
            { date: '2026-04-19', questionCount: 10 },
            { date: '2026-04-22', questionCount: 5 },
            { date: '2026-04-23', questionCount: 5 },
        ]);
        const r = replan({
            plan,
            dailyProgress: [],
            today: '2026-04-21',
            manualMoves: [{ fromDate: '2026-04-22', toDate: '2026-04-23' }],
            options: { now },
        });
        // manual move: 5 -> 23 (now 10), 22 -> 0
        // past debt: 10 questions from 04-19, redistribute to future days
        expect(r.diff.manualMovesApplied).toBe(1);
        expect(r.diff.totalDebtQuestions).toBe(10);
    });

    it('fromDate === toDate の move は無視される', () => {
        const plan = buildPlan([{ date: '2026-04-22', questionCount: 10 }]);
        const r = replan({
            plan,
            dailyProgress: [],
            today: '2026-04-21',
            manualMoves: [{ fromDate: '2026-04-22', toDate: '2026-04-22' }],
            options: { now },
        });
        expect(r.diff.manualMovesApplied).toBe(0);
        // overflowed 'manual_move_invalid' は記録される (qty > 0)
        expect(r.diff.overflowed.some((o) => o.reason === 'manual_move_invalid')).toBe(true);
    });
});
