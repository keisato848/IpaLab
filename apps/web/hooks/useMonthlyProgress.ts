/**
 * useMonthlyProgress - 月次定量目標の進捗を計算するフック
 *
 * StudyPlan.monthlyGoals に定義された定量目標に対して、
 * 今月の学習記録（LearningRecord）から実績値を計算し進捗率を返す。
 */
import { useMemo } from 'react';
import { LearningRecord } from '@/lib/api';
import { MonthlyGoal } from '@/components/features/dashboard/GoalSettingWizard';

export interface MonthlyGoalProgress extends MonthlyGoal {
    currentValue: number;
    progressPercent: number;
    isAchieved: boolean;
}

export interface MonthlyProgressSummary {
    goals: MonthlyGoalProgress[];
    overallPercent: number;
    achievedCount: number;
    totalGoals: number;
    monthLabel: string;
}

/**
 * 今月の開始/終了日を取得
 */
function getMonthRange(): { start: Date; end: Date; label: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    return { start, end, label };
}

export function useMonthlyProgress(
    monthlyGoals: MonthlyGoal[] | undefined,
    records: LearningRecord[],
    targetExamPrefix?: string
): MonthlyProgressSummary {
    return useMemo(() => {
        const { start, end, label } = getMonthRange();

        // 今月の記録のみ抽出
        const monthRecords = records.filter(r => {
            if (!r?.answeredAt) return false;
            const d = new Date(r.answeredAt);
            return d >= start && d <= end;
        });

        // 試験種別フィルター（プランに紐づく試験のみカウント）
        const filteredRecords = targetExamPrefix
            ? monthRecords.filter(r => r.examId?.startsWith(targetExamPrefix))
            : monthRecords;

        // 学習日数（ユニークな日付数）
        const uniqueDays = new Set(
            monthRecords.map(r => new Date(r.answeredAt).toISOString().split('T')[0])
        );
        const studyDayCount = uniqueDays.size;

        // questionIdで重複排除（同一問題への複数回解答は最新のみ採用）
        const latestMap = new Map<string, LearningRecord>();
        [...filteredRecords]
            .sort((a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime())
            .forEach(r => { latestMap.set(r.questionId, r); });
        const uniqueFilteredRecords = Array.from(latestMap.values());

        // 正答数
        const correctCount = uniqueFilteredRecords.filter(r => r.isCorrect).length;

        // 正答率（%）
        const accuracy = uniqueFilteredRecords.length > 0
            ? Math.round((correctCount / uniqueFilteredRecords.length) * 100)
            : 0;

        // 問題数（ユニーク問題数）
        const questionCount = uniqueFilteredRecords.length;

        if (!monthlyGoals || monthlyGoals.length === 0) {
            return {
                goals: [],
                overallPercent: 0,
                achievedCount: 0,
                totalGoals: 0,
                monthLabel: label,
            };
        }

        const goals: MonthlyGoalProgress[] = monthlyGoals.map(goal => {
            let currentValue = 0;
            switch (goal.type) {
                case 'questionCount':
                    currentValue = questionCount;
                    break;
                case 'accuracy':
                    currentValue = accuracy;
                    break;
                case 'studyDays':
                    currentValue = studyDayCount;
                    break;
                case 'correctCount':
                    currentValue = correctCount;
                    break;
                case 'custom':
                    // カスタム目標はlocalStorageから手動で値を取得
                    currentValue = getCustomGoalValue(goal.id);
                    break;
            }

            const progressPercent = goal.targetValue > 0
                ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
                : 0;

            return {
                ...goal,
                currentValue,
                progressPercent,
                isAchieved: currentValue >= goal.targetValue,
            };
        });

        const achievedCount = goals.filter(g => g.isAchieved).length;
        const overallPercent = goals.length > 0
            ? Math.round(goals.reduce((sum, g) => sum + g.progressPercent, 0) / goals.length)
            : 0;

        return {
            goals,
            overallPercent,
            achievedCount,
            totalGoals: goals.length,
            monthLabel: label,
        };
    }, [monthlyGoals, records, targetExamPrefix]);
}

/**
 * カスタム目標の手動入力値をlocalStorageから取得
 */
function getCustomGoalValue(goalId: string): number {
    try {
        const key = `monthlyGoalCustom_${goalId}`;
        const val = localStorage.getItem(key);
        return val ? parseInt(val, 10) || 0 : 0;
    } catch {
        return 0;
    }
}

/**
 * デフォルトの月次定量目標を生成
 * プラン作成時のデフォルト値として使用
 */
export function createDefaultMonthlyGoals(
    weeklySchedule: { dailyTasks: { questionCount: number }[] }[]
): MonthlyGoal[] {
    // weeklyScheduleの今月分から問題数目標を算出
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalQuestions = 0;
    let totalDays = 0;

    weeklySchedule?.forEach(week => {
        week.dailyTasks?.forEach(task => {
            // 日付が今月かチェック（日付がある場合）
            const taskDate = (task as any).date ? new Date((task as any).date) : null;
            if (taskDate && taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear) {
                totalQuestions += task.questionCount || 0;
                totalDays++;
            }
        });
    });

    // プランに日付情報がなければフォールバック
    if (totalQuestions === 0) {
        totalQuestions = 200;
        totalDays = 20;
    }

    return [
        {
            id: 'monthly-questions',
            label: '問題演習数',
            type: 'questionCount',
            targetValue: totalQuestions,
            unit: '問',
            iconEmoji: '📝',
        },
        {
            id: 'monthly-accuracy',
            label: '正答率',
            type: 'accuracy',
            targetValue: 70,
            unit: '%',
            iconEmoji: '🎯',
        },
        {
            id: 'monthly-study-days',
            label: '学習日数',
            type: 'studyDays',
            targetValue: Math.min(totalDays, 25),
            unit: '日',
            iconEmoji: '📅',
        },
        {
            id: 'monthly-correct',
            label: '正解数',
            type: 'correctCount',
            targetValue: Math.round(totalQuestions * 0.7),
            unit: '問',
            iconEmoji: '✅',
        },
    ];
}
