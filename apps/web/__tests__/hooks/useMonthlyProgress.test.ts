import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMonthlyProgress, createDefaultMonthlyGoals } from '@/hooks/useMonthlyProgress';
import type { LearningRecord } from '@/lib/api';
import type { MonthlyGoal } from '@/components/features/dashboard/GoalSettingWizard';

// ------------------------------------------
// テスト用ヘルパー
// ------------------------------------------

/** 今月のN日目の日時文字列を生成 */
function thisMonthDate(day: number, hour = 10): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), day, hour).toISOString();
}

/** 先月の日時文字列を生成 */
function lastMonthDate(day: number): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, day, 10).toISOString();
}

/** テスト用LearningRecordを生成 */
function makeRecord(overrides: Partial<LearningRecord> = {}): LearningRecord {
    return {
        userId: 'test-user',
        questionId: `AP-2025-Fall-AM-Q${Math.floor(Math.random() * 80) + 1}`,
        examId: 'AP-2025-Fall-AM',
        category: 'テクノロジ',
        isCorrect: true,
        answeredAt: thisMonthDate(5),
        timeTakenSeconds: 30,
        ...overrides,
    };
}

/** テスト用MonthlyGoalを生成 */
function makeGoal(overrides: Partial<MonthlyGoal> = {}): MonthlyGoal {
    return {
        id: 'test-goal',
        label: 'テスト目標',
        type: 'questionCount',
        targetValue: 100,
        unit: '問',
        iconEmoji: '📝',
        ...overrides,
    };
}

// ------------------------------------------
// useMonthlyProgress フック テスト
// ------------------------------------------

describe('useMonthlyProgress', () => {
    describe('空のデータ処理', () => {
        it('monthlyGoalsがundefinedの場合、空のサマリーを返す', () => {
            const { result } = renderHook(() =>
                useMonthlyProgress(undefined, [], undefined)
            );

            expect(result.current.goals).toEqual([]);
            expect(result.current.totalGoals).toBe(0);
            expect(result.current.overallPercent).toBe(0);
            expect(result.current.achievedCount).toBe(0);
        });

        it('monthlyGoalsが空配列の場合、空のサマリーを返す', () => {
            const { result } = renderHook(() =>
                useMonthlyProgress([], [], undefined)
            );

            expect(result.current.goals).toEqual([]);
            expect(result.current.totalGoals).toBe(0);
        });

        it('recordsが空でも目標は返される（進捗0%）', () => {
            const goals = [makeGoal({ type: 'questionCount', targetValue: 50 })];
            const { result } = renderHook(() =>
                useMonthlyProgress(goals, [], undefined)
            );

            expect(result.current.goals).toHaveLength(1);
            expect(result.current.goals[0].currentValue).toBe(0);
            expect(result.current.goals[0].progressPercent).toBe(0);
            expect(result.current.goals[0].isAchieved).toBe(false);
        });
    });

    describe('monthLabelの出力', () => {
        it('現在の年月ラベルを返す', () => {
            const { result } = renderHook(() =>
                useMonthlyProgress([], [], undefined)
            );

            const now = new Date();
            const expected = `${now.getFullYear()}年${now.getMonth() + 1}月`;
            expect(result.current.monthLabel).toBe(expected);
        });
    });

    describe('問題演習数 (questionCount)', () => {
        it('今月の記録数を正しくカウントする', () => {
            const goals = [makeGoal({ type: 'questionCount', targetValue: 10 })];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1) }),
                makeRecord({ answeredAt: thisMonthDate(3) }),
                makeRecord({ answeredAt: thisMonthDate(5) }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            expect(result.current.goals[0].currentValue).toBe(3);
            expect(result.current.goals[0].progressPercent).toBe(30); // 3/10 = 30%
        });

        it('先月の記録は除外される', () => {
            const goals = [makeGoal({ type: 'questionCount', targetValue: 10 })];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1) }),
                makeRecord({ answeredAt: lastMonthDate(15) }),
                makeRecord({ answeredAt: lastMonthDate(20) }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            expect(result.current.goals[0].currentValue).toBe(1);
        });

        it('目標達成時にisAchieved=trueになる', () => {
            const goals = [makeGoal({ type: 'questionCount', targetValue: 2 })];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1) }),
                makeRecord({ answeredAt: thisMonthDate(2) }),
                makeRecord({ answeredAt: thisMonthDate(3) }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            expect(result.current.goals[0].isAchieved).toBe(true);
            expect(result.current.goals[0].progressPercent).toBe(100); // capped at 100
        });
    });

    describe('正答率 (accuracy)', () => {
        it('正答率を正しく計算する', () => {
            const goals = [makeGoal({ type: 'accuracy', targetValue: 70 })];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1), isCorrect: true }),
                makeRecord({ answeredAt: thisMonthDate(2), isCorrect: true }),
                makeRecord({ answeredAt: thisMonthDate(3), isCorrect: false }),
                makeRecord({ answeredAt: thisMonthDate(4), isCorrect: true }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            // 3/4 = 75%
            expect(result.current.goals[0].currentValue).toBe(75);
            expect(result.current.goals[0].isAchieved).toBe(true);
        });

        it('記録0件の場合は正答率0', () => {
            const goals = [makeGoal({ type: 'accuracy', targetValue: 70 })];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, [], undefined)
            );

            expect(result.current.goals[0].currentValue).toBe(0);
        });
    });

    describe('学習日数 (studyDays)', () => {
        it('ユニークな学習日数を正しくカウントする', () => {
            const goals = [makeGoal({ type: 'studyDays', targetValue: 10 })];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1, 9) }),
                makeRecord({ answeredAt: thisMonthDate(1, 14) }),  // 同日
                makeRecord({ answeredAt: thisMonthDate(3, 10) }),
                makeRecord({ answeredAt: thisMonthDate(5, 10) }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            expect(result.current.goals[0].currentValue).toBe(3); // 1日, 3日, 5日
        });
    });

    describe('正解数 (correctCount)', () => {
        it('正解数を正しくカウントする', () => {
            const goals = [makeGoal({ type: 'correctCount', targetValue: 5 })];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1), isCorrect: true }),
                makeRecord({ answeredAt: thisMonthDate(2), isCorrect: false }),
                makeRecord({ answeredAt: thisMonthDate(3), isCorrect: true }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            expect(result.current.goals[0].currentValue).toBe(2);
        });
    });

    describe('試験種別フィルター (targetExamPrefix)', () => {
        it('指定プレフィックスの記録のみカウントする', () => {
            const goals = [makeGoal({ type: 'questionCount', targetValue: 10 })];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1), examId: 'AP-2025-Fall-AM' }),
                makeRecord({ answeredAt: thisMonthDate(2), examId: 'AP-2024-Spring-AM' }),
                makeRecord({ answeredAt: thisMonthDate(3), examId: 'SC-2025-Fall-AM' }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, 'AP')
            );

            expect(result.current.goals[0].currentValue).toBe(2); // AP系のみ
        });

        it('学習日数はフィルター適用前の全記録でカウントする', () => {
            const goals = [makeGoal({ type: 'studyDays', targetValue: 10 })];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1), examId: 'AP-2025-Fall-AM' }),
                makeRecord({ answeredAt: thisMonthDate(2), examId: 'SC-2025-Fall-AM' }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, 'AP')
            );

            // studyDaysはfilteredではなくmonthRecords全体でカウント
            expect(result.current.goals[0].currentValue).toBe(2);
        });
    });

    describe('複数目標の総合進捗', () => {
        it('overallPercentは目標ごとの平均', () => {
            const goals = [
                makeGoal({ id: 'g1', type: 'questionCount', targetValue: 10 }),
                makeGoal({ id: 'g2', type: 'studyDays', targetValue: 10 }),
            ];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1) }),
                makeRecord({ answeredAt: thisMonthDate(2) }),
                makeRecord({ answeredAt: thisMonthDate(3) }),
                makeRecord({ answeredAt: thisMonthDate(4) }),
                makeRecord({ answeredAt: thisMonthDate(5) }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            // questionCount: 5/10 = 50%, studyDays: 5/10 = 50%
            expect(result.current.overallPercent).toBe(50);
            expect(result.current.achievedCount).toBe(0);
            expect(result.current.totalGoals).toBe(2);
        });

        it('achievedCountは達成した目標数を正しく返す', () => {
            const goals = [
                makeGoal({ id: 'g1', type: 'questionCount', targetValue: 2 }),
                makeGoal({ id: 'g2', type: 'studyDays', targetValue: 100 }),
            ];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1) }),
                makeRecord({ answeredAt: thisMonthDate(2) }),
                makeRecord({ answeredAt: thisMonthDate(3) }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            expect(result.current.achievedCount).toBe(1); // questionCountのみ達成
        });
    });

    describe('プログレスの上限', () => {
        it('progressPercentは100%を超えない', () => {
            const goals = [makeGoal({ type: 'questionCount', targetValue: 2 })];
            const records = Array.from({ length: 10 }, (_, i) =>
                makeRecord({ answeredAt: thisMonthDate(i + 1) })
            );

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            expect(result.current.goals[0].progressPercent).toBe(100);
            expect(result.current.goals[0].currentValue).toBe(10); // 実績値は実数
        });
    });

    describe('不正なレコードの処理', () => {
        it('answeredAtが空のレコードは無視される', () => {
            const goals = [makeGoal({ type: 'questionCount', targetValue: 10 })];
            const records = [
                makeRecord({ answeredAt: thisMonthDate(1) }),
                makeRecord({ answeredAt: '' }),  // 不正
                makeRecord({ answeredAt: thisMonthDate(3) }),
            ];

            const { result } = renderHook(() =>
                useMonthlyProgress(goals, records, undefined)
            );

            expect(result.current.goals[0].currentValue).toBe(2);
        });
    });
});

// ------------------------------------------
// createDefaultMonthlyGoals テスト
// ------------------------------------------

describe('createDefaultMonthlyGoals', () => {
    it('weeklyScheduleから今月分の問題数を算出する', () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const schedule = [
            {
                dailyTasks: [
                    { date: new Date(year, month, 1).toISOString(), questionCount: 10 },
                    { date: new Date(year, month, 2).toISOString(), questionCount: 15 },
                ],
            },
            {
                dailyTasks: [
                    { date: new Date(year, month, 8).toISOString(), questionCount: 10 },
                    // 来月の日付は除外される
                    { date: new Date(year, month + 1, 1).toISOString(), questionCount: 99 },
                ],
            },
        ];

        const goals = createDefaultMonthlyGoals(schedule as any);

        expect(goals).toHaveLength(4);

        // 問題演習数: 10 + 15 + 10 = 35 (来月の99は除外)
        const questionGoal = goals.find(g => g.type === 'questionCount')!;
        expect(questionGoal.targetValue).toBe(35);

        // 正答率は固定で70%
        const accuracyGoal = goals.find(g => g.type === 'accuracy')!;
        expect(accuracyGoal.targetValue).toBe(70);

        // 学習日数: 今月3日分（最大25）
        const studyDaysGoal = goals.find(g => g.type === 'studyDays')!;
        expect(studyDaysGoal.targetValue).toBe(3);

        // 正解数: 35 * 0.7 = 25 (四捨五入)
        const correctGoal = goals.find(g => g.type === 'correctCount')!;
        expect(correctGoal.targetValue).toBe(Math.round(35 * 0.7));
    });

    it('日付情報がないスケジュールの場合、フォールバック値を使う', () => {
        const schedule = [
            { dailyTasks: [{ questionCount: 10 }] },
        ];

        const goals = createDefaultMonthlyGoals(schedule as any);

        // フォールバック: 200問, 20日
        const questionGoal = goals.find(g => g.type === 'questionCount')!;
        expect(questionGoal.targetValue).toBe(200);

        const studyDaysGoal = goals.find(g => g.type === 'studyDays')!;
        expect(studyDaysGoal.targetValue).toBe(20);
    });

    it('空のスケジュールでもフォールバック値で4目標を返す', () => {
        const goals = createDefaultMonthlyGoals([]);
        expect(goals).toHaveLength(4);

        const types = goals.map(g => g.type);
        expect(types).toContain('questionCount');
        expect(types).toContain('accuracy');
        expect(types).toContain('studyDays');
        expect(types).toContain('correctCount');
    });

    it('全目標にid, label, unit, iconEmojiが設定されている', () => {
        const goals = createDefaultMonthlyGoals([]);
        goals.forEach(g => {
            expect(g.id).toBeTruthy();
            expect(g.label).toBeTruthy();
            expect(g.unit).toBeTruthy();
            expect(g.iconEmoji).toBeTruthy();
            expect(g.targetValue).toBeGreaterThan(0);
        });
    });
});
