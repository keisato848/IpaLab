/**
 * POST /api/study-plan/health-check
 *
 * 入力: PerformanceProfile (クライアントが /api/profile/performance で取得し POST)
 * 出力: PlanHealthResult
 *
 * 純粋関数 evaluatePlanHealth を呼ぶだけのシン API。AI 呼び出しなし。
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/auth';
import { evaluatePlanHealth } from '@/lib/plan/healthCheck';
import type { PerformanceProfile } from '@/lib/types/performanceProfile';

export const dynamic = 'force-dynamic';

const CategoryAccuracySchema = z.object({
    total: z.number().nonnegative(),
    correct: z.number().nonnegative(),
    rate: z.number().min(0).max(1),
});

const PerformanceProfileSchema = z.object({
    userId: z.string(),
    generatedAt: z.string(),
    paceByWeekday: z.array(z.number().nonnegative()).length(7),
    recentAchievementRate: z.number().nonnegative().finite(),
    consecutiveOnFireDays: z.number().int().nonnegative().finite(),
    accuracyByCategory: z.record(z.string(), CategoryAccuracySchema),
    continuityRate: z.number().min(0).max(1),
    consecutiveStudyDays: z.number().int().nonnegative(),
    paceRatio: z.number().nonnegative().finite(),
});

const RequestBodySchema = z.object({
    profile: PerformanceProfileSchema,
});

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let raw: unknown = {};
    try {
        const text = await request.text();
        if (text) raw = JSON.parse(text);
    } catch {
        return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    const parsed = RequestBodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'INVALID_INPUT', issues: parsed.error.issues },
            { status: 400 },
        );
    }

    try {
        const result = evaluatePlanHealth(parsed.data.profile as PerformanceProfile);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[health-check] failed', error);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
