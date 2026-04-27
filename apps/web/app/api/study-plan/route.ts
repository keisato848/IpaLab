import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { studyPlanRepository } from '@/lib/repositories/studyPlanRepository';
import { StudyPlanSchema } from '@/lib/types/studyPlanSchema';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/study-plan
 * 認証ユーザーの全学習計画を返す
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const plans = await studyPlanRepository.listByUser(session.user.id);
        return NextResponse.json(plans);
    } catch (error) {
        console.error('[study-plan GET] failed', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Internal Server Error', details: message },
            { status: 500 },
        );
    }
}

/**
 * POST /api/study-plan
 * - body: StudyPlan 1件 → 単発 upsert
 * - body: StudyPlan[] → 一括 upsert（localStorage → サーバ移行用）
 *
 * 既存 id があれば上書き、無い場合はクライアント側で必ず id を採番済み。
 */
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();

        if (Array.isArray(body)) {
            const parsed = z.array(StudyPlanSchema).safeParse(body);
            if (!parsed.success) {
                return NextResponse.json(
                    { error: 'Invalid data', details: parsed.error.format() },
                    { status: 400 },
                );
            }
            const count = await studyPlanRepository.upsertMany(session.user.id, parsed.data);
            return NextResponse.json({ count }, { status: 200 });
        }

        const parsed = StudyPlanSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid data', details: parsed.error.format() },
                { status: 400 },
            );
        }
        const saved = await studyPlanRepository.upsert(session.user.id, parsed.data);
        return NextResponse.json(saved, { status: 200 });
    } catch (error) {
        console.error('[study-plan POST] failed', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Internal Server Error', details: message },
            { status: 500 },
        );
    }
}
