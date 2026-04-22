/**
 * StudyPlan 共通型 (#189 設計書 §4 / 1本化)
 *
 * 以前は `apps/web/lib/api.ts` (id 無し) と
 * `apps/web/components/features/dashboard/GoalSettingWizard.tsx` (id あり)
 * の 2 か所で StudyPlan が重複定義されていた。
 * 編集UI (#189) の前提として本ファイルに集約し、両者は re-export に切り替える。
 */

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface MonthlyGoal {
    id: string;
    label: string;
    type: 'questionCount' | 'accuracy' | 'studyDays' | 'correctCount' | 'custom';
    targetValue: number;
    unit: string;
    iconEmoji: string;
}

export interface DailyTask {
    /** YYYY-MM-DD */
    date: string;
    missionTitle?: string;
    goal: string;
    questionCount: number;
    targetCategory?: string;
    targetExamId?: string;
    difficulty?: Difficulty;
    xpReward?: number;
    isCompleted?: boolean;
}

export interface WeeklyScheduleItem {
    weekNumber: number;
    /** YYYY-MM-DD */
    startDate: string;
    /** YYYY-MM-DD */
    endDate: string;
    theme?: string;
    goal: string;
    focus?: string;
    dailyTasks: DailyTask[];
}

export interface StudyPlan {
    /**
     * 計画 ID。
     * 新規生成時は `crypto.randomUUID()` で必ず付与する。
     * legacy localStorage データは DashboardClient のマイグレーションで補完される。
     */
    id: string;
    title: string;
    /** 'AP' | 'FE' | 'SC' | ... 暫定で string 受け */
    targetExam?: string;
    /** YYYY-MM-DD */
    examDate: string;
    hoursWeekday?: number;
    hoursWeekend?: number;
    monthlyGoal: string;
    monthlyGoals?: MonthlyGoal[];
    weeklySchedule: WeeklyScheduleItem[];
    generatedAt: string;
    totalXpEarned?: number;
}
