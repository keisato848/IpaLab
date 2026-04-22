import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { studyPlanRepository } from '@/lib/repositories/studyPlanRepository';
import { StudyPlanSchema } from '@/lib/types/studyPlanSchema';

export const dynamic = 'force-dynamic';

/**
 * GET /api/study-plan/[id]
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const plan = await studyPlanRepository.findById(session.user.id, id);
        if (!plan) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }
        return NextResponse.json(plan);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Internal Server Error', details: message },
            { status: 500 },
        );
    }
}

/**
 * PUT /api/study-plan/[id]
 * 既存計画を全置換 (upsert)。body の id は path id と一致必須。
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const parsed = StudyPlanSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid data', details: parsed.error.format() },
                { status: 400 },
            );
        }
        if (parsed.data.id !== id) {
            return NextResponse.json(
                { error: 'id mismatch between body and path' },
                { status: 400 },
            );
        }
        const saved = await studyPlanRepository.upsert(session.user.id, parsed.data);
        return NextResponse.json(saved);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Internal Server Error', details: message },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/study-plan/[id]
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const removed = await studyPlanRepository.remove(session.user.id, id);
        if (!removed) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Internal Server Error', details: message },
            { status: 500 },
        );
    }
}
