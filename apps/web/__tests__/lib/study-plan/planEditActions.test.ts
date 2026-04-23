import { describe, it, expect } from 'vitest';
import {
    applyEditState,
    cycleEditMode,
    setEditMode,
    listAllDates,
    type EditState,
} from '@/lib/study-plan/planEditActions';
import type { StudyPlan } from '@/lib/types/studyPlan';

const basePlan: StudyPlan = {
    id: 'plan-1',
    title: 'AP 2025 Spring',
    targetExam: 'AP',
    examDate: '2025-04-20',
    monthlyGoal: '基礎を固める',
    generatedAt: '2025-01-01T00:00:00.000Z',
    weeklySchedule: [
        {
            weekNumber: 1,
            startDate: '2025-01-06',
            endDate: '2025-01-12',
            goal: 'week 1',
            dailyTasks: [
                { date: '2025-01-06', goal: 'mon', questionCount: 10 },
                { date: '2025-01-07', goal: 'tue', questionCount: 10 },
                { date: '2025-01-08', goal: 'wed', questionCount: 12 },
            ],
        },
    ],
};

describe('applyEditState', () => {
    it('returns a new plan instance (immutability)', () => {
        const next = applyEditState(basePlan, {});
        expect(next).not.toBe(basePlan);
        expect(next.weeklySchedule).not.toBe(basePlan.weeklySchedule);
        expect(next.weeklySchedule[0].dailyTasks).not.toBe(basePlan.weeklySchedule[0].dailyTasks);
    });

    it('keeps questionCount when no edits', () => {
        const next = applyEditState(basePlan, {});
        expect(next.weeklySchedule[0].dailyTasks.map((t) => t.questionCount)).toEqual([10, 10, 12]);
    });

    it('rest mode zeros questionCount', () => {
        const edits: EditState = { '2025-01-07': 'rest' };
        const next = applyEditState(basePlan, edits);
        expect(next.weeklySchedule[0].dailyTasks[1].questionCount).toBe(0);
    });

    it('does not mutate the input plan', () => {
        const snapshot = JSON.parse(JSON.stringify(basePlan));
        applyEditState(basePlan, { '2025-01-06': 'rest', '2025-01-07': 'rest' });
        expect(basePlan).toEqual(snapshot);
    });
});

describe('cycleEditMode', () => {
    it('toggles between normal and rest', () => {
        expect(cycleEditMode(undefined)).toBe('rest');
        expect(cycleEditMode('normal')).toBe('rest');
        expect(cycleEditMode('rest')).toBe('normal');
    });
});

describe('setEditMode', () => {
    it('removes the entry when mode=normal', () => {
        const state: EditState = { '2025-01-06': 'rest' };
        const next = setEditMode(state, '2025-01-06', 'normal');
        expect(next).toEqual({});
    });

    it('sets non-normal modes', () => {
        expect(setEditMode({}, '2025-01-06', 'rest')).toEqual({ '2025-01-06': 'rest' });
    });

    it('returns a new object (immutability)', () => {
        const state: EditState = {};
        const next = setEditMode(state, '2025-01-06', 'rest');
        expect(next).not.toBe(state);
    });
});

describe('listAllDates', () => {
    it('returns dates sorted', () => {
        expect(listAllDates(basePlan)).toEqual(['2025-01-06', '2025-01-07', '2025-01-08']);
    });

    it('handles weeks where dailyTasks is undefined (regression: #189 staging crash)', () => {
        const planWithEmptyWeek: StudyPlan = {
            ...basePlan,
            weeklySchedule: [
                ...basePlan.weeklySchedule,
                {
                    weekNumber: 2,
                    startDate: '2025-01-13',
                    endDate: '2025-01-19',
                    goal: 'transition week (not yet generated)',
                    // dailyTasks is intentionally omitted
                } as unknown as (typeof basePlan.weeklySchedule)[number],
            ],
        };
        expect(() => listAllDates(planWithEmptyWeek)).not.toThrow();
        expect(listAllDates(planWithEmptyWeek)).toEqual(['2025-01-06', '2025-01-07', '2025-01-08']);
    });
});

describe('applyEditState (regression)', () => {
    it('does not throw when a week has no dailyTasks', () => {
        const planWithEmptyWeek: StudyPlan = {
            ...basePlan,
            weeklySchedule: [
                ...basePlan.weeklySchedule,
                {
                    weekNumber: 2,
                    startDate: '2025-01-13',
                    endDate: '2025-01-19',
                    goal: 'transition week',
                } as unknown as (typeof basePlan.weeklySchedule)[number],
            ],
        };
        expect(() => applyEditState(planWithEmptyWeek, {})).not.toThrow();
        const next = applyEditState(planWithEmptyWeek, {});
        expect(next.weeklySchedule[1].dailyTasks).toEqual([]);
    });
});
