import { z } from 'zod';

/**
 * StudyPlan の Zod スキーマ。
 * `lib/types/studyPlan.ts` の TS 型と整合している必要がある。
 *
 * #212 で API 永続化用に追加。
 * - dailyTasks は legacy データ（未生成週）で undefined もありえるため optional
 * - id は Cosmos の docID と一致（partitionKey は /userId）
 */

export const DailyTaskSchema = z.object({
    date: z.string(),
    missionTitle: z.string().optional(),
    goal: z.string(),
    questionCount: z.number(),
    targetCategory: z.string().optional(),
    targetExamId: z.string().optional(),
    difficulty: z.enum(['easy', 'normal', 'hard']).optional(),
    xpReward: z.number().optional(),
    isCompleted: z.boolean().optional(),
});

export const WeeklyScheduleItemSchema = z.object({
    weekNumber: z.number(),
    startDate: z.string(),
    endDate: z.string(),
    theme: z.string().optional(),
    goal: z.string(),
    focus: z.string().optional(),
    dailyTasks: z.array(DailyTaskSchema).optional().default([]),
});

export const MonthlyGoalSchema = z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(['questionCount', 'accuracy', 'studyDays', 'correctCount', 'custom']),
    targetValue: z.number(),
    unit: z.string(),
    iconEmoji: z.string(),
});

export const StudyPlanSchema = z.object({
    id: z.string(),
    title: z.string(),
    targetExam: z.string().optional(),
    examDate: z.string(),
    hoursWeekday: z.number().optional(),
    hoursWeekend: z.number().optional(),
    monthlyGoal: z.string(),
    monthlyGoals: z.array(MonthlyGoalSchema).optional(),
    weeklySchedule: z.array(WeeklyScheduleItemSchema),
    generatedAt: z.string(),
    totalXpEarned: z.number().optional(),
});

/** Cosmos に保存する内部表現 (userId を付与) */
export const StoredStudyPlanSchema = StudyPlanSchema.extend({
    userId: z.string(),
});

export type StoredStudyPlan = z.infer<typeof StoredStudyPlanSchema>;
