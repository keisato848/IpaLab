/**
 * 学習計画セレクタ（純粋関数）のユニットテスト（WP-4.2）
 */
import type { Mobile } from '@ipa-lab/shared';
import { selectActivePlan, daysUntilExam, selectTodayTask } from '../plan-selectors';

function makePlan(overrides: Partial<Mobile.MobileStudyPlan> = {}): Mobile.MobileStudyPlan {
    return {
        id: 'p1',
        version: 0,
        title: '基本情報 合格計画',
        examDate: '2026-10-18',
        monthlyGoal: '午前突破',
        weeklySchedule: [],
        generatedAt: '2026-06-01T00:00:00.000Z',
        ...overrides,
    };
}

describe('plan-selectors', () => {
    describe('selectActivePlan', () => {
        it('空配列は null を返す', () => {
            expect(selectActivePlan([])).toBeNull();
        });

        it('generatedAt が最新の計画を返す', () => {
            const older = makePlan({ id: 'old', generatedAt: '2026-05-01T00:00:00.000Z' });
            const newer = makePlan({ id: 'new', generatedAt: '2026-06-10T00:00:00.000Z' });
            expect(selectActivePlan([older, newer])?.id).toBe('new');
        });
    });

    describe('daysUntilExam', () => {
        it('試験日までの残り日数を返す', () => {
            expect(daysUntilExam('2026-06-25', '2026-06-21T09:00:00.000Z')).toBe(4);
        });

        it('過去日は負値を返す', () => {
            expect(daysUntilExam('2026-06-20', '2026-06-21')).toBe(-1);
        });

        it('不正な日付は null を返す', () => {
            expect(daysUntilExam('not-a-date', '2026-06-21')).toBeNull();
        });
    });

    describe('selectTodayTask', () => {
        const plan = makePlan({
            weeklySchedule: [
                {
                    weekNumber: 1,
                    startDate: '2026-06-15',
                    endDate: '2026-06-21',
                    goal: '第1週',
                    dailyTasks: [
                        { date: '2026-06-20', goal: '昨日のタスク', questionCount: 10 },
                        { date: '2026-06-21', goal: '今日のタスク', questionCount: 20 },
                    ],
                },
            ],
        });

        it('今日に該当する日次タスクを返す', () => {
            expect(selectTodayTask(plan, '2026-06-21T08:00:00.000Z')?.goal).toBe('今日のタスク');
        });

        it('該当タスクがなければ null を返す', () => {
            expect(selectTodayTask(plan, '2026-06-22')).toBeNull();
        });
    });
});
