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

import { authOptions } from '@/auth';
import { evaluatePlanHealth } from '@/lib/plan/healthCheck';
import type { PerformanceProfile } from '@/lib/types/performanceProfile';

export const dynamic = 'force-dynamic';

interface HealthCheckRequestBody {
    profile?: PerformanceProfile;
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: HealthCheckRequestBody = {};
    try {
        const text = await request.text();
        if (text) body = JSON.parse(text) as HealthCheckRequestBody;
    } catch {
        return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    if (!body.profile) {
        return NextResponse.json(
            { error: 'MISSING_PROFILE', message: 'profile を request body に含めてください' },
            { status: 400 },
        );
    }

    try {
        const result = evaluatePlanHealth(body.profile);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[health-check] failed', error);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
