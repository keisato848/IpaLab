/**
 * Mobile API 学習計画 DTO（詳細設計 26_AndroidPlayDetailedDesign.md §6, WP-4.2）
 *
 * - version フィールドで楽観ロックを実現する。
 * - PUT 時に version 不一致 → 409 VERSION_CONFLICT。
 */
import { z } from 'zod';

// ---- 基本エンティティ ----

const mobileDailyTaskSchema = z.object({
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

const mobileWeeklyScheduleItemSchema = z.object({
    weekNumber: z.number(),
    startDate: z.string(),
    endDate: z.string(),
    theme: z.string().optional(),
    goal: z.string(),
    focus: z.string().optional(),
    dailyTasks: z.array(mobileDailyTaskSchema).optional().default([]),
});

const mobileMonthlyGoalSchema = z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(['questionCount', 'accuracy', 'studyDays', 'correctCount', 'custom']),
    targetValue: z.number(),
    unit: z.string(),
    iconEmoji: z.string(),
});

/** Mobile 学習計画（version付き）。 */
export const mobileStudyPlanSchema = z.object({
    id: z.string(),
    /** 楽観ロック用バージョン。新規作成時は 0、更新のたびに +1。 */
    version: z.number().int().min(0),
    title: z.string(),
    targetExam: z.string().optional(),
    examDate: z.string(),
    hoursWeekday: z.number().optional(),
    hoursWeekend: z.number().optional(),
    monthlyGoal: z.string(),
    monthlyGoals: z.array(mobileMonthlyGoalSchema).optional(),
    weeklySchedule: z.array(mobileWeeklyScheduleItemSchema),
    generatedAt: z.string(),
    totalXpEarned: z.number().optional(),
});

export type MobileStudyPlan = z.infer<typeof mobileStudyPlanSchema>;

// ---- レスポンス ----

export const studyPlansListResponseSchema = z.object({
    plans: z.array(mobileStudyPlanSchema),
});

export type StudyPlansListResponse = z.infer<typeof studyPlansListResponseSchema>;

// ---- リクエスト ----

/** PUT ボディ。version を含めて送信する（楽観ロック）。 */
export const studyPlanUpdateRequestSchema = mobileStudyPlanSchema;

export type StudyPlanUpdateRequest = z.infer<typeof studyPlanUpdateRequestSchema>;
