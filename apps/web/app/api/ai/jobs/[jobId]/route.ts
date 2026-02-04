/**
 * Job Details API
 * GET /api/ai/jobs/[jobId] - 特定のジョブを取得
 * PATCH /api/ai/jobs/[jobId] - ジョブを更新（通知済み/破棄フラグ）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { getContainer } from '@/lib/cosmos';

interface RouteParams {
    params: Promise<{
        jobId: string;
    }>;
}

/**
 * GET /api/ai/jobs/[jobId]
 * 特定のジョブを取得
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }

        const userId = session.user.id;
        const { jobId } = await params;

        const container = await getContainer('PlanJobs');
        if (!container) {
            return NextResponse.json({ error: 'データベース接続エラー' }, { status: 500 });
        }

        // userId をパーティションキーとして読み取り
        const { resource } = await container.item(jobId, userId).read();

        if (!resource) {
            return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 });
        }

        // ユーザー確認（念のため）
        if (resource.userId !== userId) {
            return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 });
        }

        return NextResponse.json(resource);

    } catch (error: any) {
        console.error('Failed to get job:', error);
        return NextResponse.json({
            error: 'ジョブの取得に失敗しました',
            details: error.message,
        }, { status: 500 });
    }
}

/**
 * PATCH /api/ai/jobs/[jobId]
 * ジョブを更新（通知済み/破棄フラグ）
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }

        const userId = session.user.id;
        const { jobId } = await params;
        const body = await req.json();

        const container = await getContainer('PlanJobs');
        if (!container) {
            return NextResponse.json({ error: 'データベース接続エラー' }, { status: 500 });
        }

        // 現在のジョブを取得
        const { resource: existingJob } = await container.item(jobId, userId).read();

        if (!existingJob) {
            return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 });
        }

        if (existingJob.userId !== userId) {
            return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 });
        }

        // 更新可能なフィールドのみ更新
        const updates: Record<string, any> = {};
        
        if (body.notifiedAt !== undefined) {
            updates.notifiedAt = body.notifiedAt;
        }
        if (body.dismissed !== undefined) {
            updates.dismissed = body.dismissed;
        }

        const updatedJob = { ...existingJob, ...updates };

        const { resource } = await container.item(jobId, userId).replace(updatedJob);

        return NextResponse.json(resource);

    } catch (error: any) {
        console.error('Failed to update job:', error);
        return NextResponse.json({
            error: 'ジョブの更新に失敗しました',
            details: error.message,
        }, { status: 500 });
    }
}
