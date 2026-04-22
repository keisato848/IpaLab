/**
 * POST /api/study-plan/replan
 *
 * 動的再計画エンジン v1.0 のエンドポイント (#188)。
 *
 * - 認証必須。`session.user.id` を正本とする
 * - body: `{ plan: StudyPlan, today?: string }`
 * - サーバ側で当該ユーザーの LearningRecord を読み、`aggregateDailyProgress` で
 *   過去日の DailyProgress を生成 → `replan(plan, dailyProgress, today)` を実行
 * - 返却: `{ plan, diff, warnings }`
 *
 * クライアント側の plan 編集 (#189) からも、日次バッチ (将来) からも同一エンドポイントを叩ける。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { z } from 'zod';
import { learningRecordRepository } from '@/lib/repositories/learningRecordRepository';
import { aggregateDailyProgress } from '@/lib/progress/aggregateDailyProgress';
import { replan } from '@/lib/plan/replan';
import type { StudyPlan } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const StudyPlanShape = z
    .object({
        title: z.string(),
        examDate: DateString,
        hoursWeekday: z.number().optional(),
        hoursWeekend: z.number().optional(),
        monthlyGoal: z.string(),
        monthlyGoals: z.array(z.unknown()).optional(),
        weeklySchedule: z.array(
            z.object({
                weekNumber: z.number(),
                startDate: z.string(),
                endDate: z.string(),
                theme: z.string().optional(),
                goal: z.string(),
                focus: z.string().optional(),
                dailyTasks: z.array(
                    z.object({
                        date: DateString,
                        missionTitle: z.string().optional(),
                        goal: z.string(),
                        questionCount: z.number().int().min(0),
                        targetCategory: z.string().optional(),
                        targetExamId: z.string().optional(),
                        difficulty: z.enum(['easy', 'normal', 'hard']).optional(),
                        xpReward: z.number().optional(),
                        isCompleted: z.boolean().optional(),
                    }),
                ),
            }),
        ),
        generatedAt: z.string(),
        totalXpEarned: z.number().optional(),
    })
    .passthrough();

const BodySchema = z.object({
    plan: StudyPlanShape,
    today: DateString.optional(),
});

function todayUtc(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
    ).padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'INVALID_INPUT', detail: parsed.error.issues },
            { status: 400 },
        );
    }
    const plan = parsed.data.plan as unknown as StudyPlan;
    const today = parsed.data.today ?? todayUtc();

    try {
        const records = await learningRecordRepository.findByUserId(userId);
        // 過去日のみ DailyProgress を作る (today の前日まで)
        const allDates = plan.weeklySchedule.flatMap((w) => w.dailyTasks.map((t) => t.date));
        const minDate = allDates.length > 0 ? allDates.reduce((a, b) => (a < b ? a : b)) : today;
        const dailyProgress = aggregateDailyProgress({
            userId,
            records,
            from: minDate,
            to: today,
        });

        const result = replan({ plan, dailyProgress, today });
        return NextResponse.json(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Internal Error';
        return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
    }
}
