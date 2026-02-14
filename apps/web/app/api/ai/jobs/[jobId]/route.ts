/**
 * Job Details API
 * GET /api/ai/jobs/[jobId] - 特定のジョブを取得
 * PATCH /api/ai/jobs/[jobId] - ジョブを更新（通知済み/破棄フラグ）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';
import { requireAuth, checkDbContainer, errorResponse, notFoundResponse } from '@/lib/api-helpers';

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
        const auth = await requireAuth();
        if (auth.error) return auth.error;

        const userId = auth.session.user.id;
        const { jobId } = await params;

        const container = await getContainer('PlanJobs');
        const dbError = checkDbContainer(container);
        if (dbError) return dbError;

        // userId をパーティションキーとして読み取り
        const { resource } = await container.item(jobId, userId).read();

        if (!resource) {
            return notFoundResponse('ジョブが見つかりません');
        }

        // ユーザー確認（念のため）
        if (resource.userId !== userId) {
            return errorResponse('アクセス権がありません', 403);
        }

        return NextResponse.json(resource);

    } catch (error: any) {
        console.error('Failed to get job:', error);
        return errorResponse(`ジョブの取得に失敗しました: ${error.message}`);
    }
}

/**
 * PATCH /api/ai/jobs/[jobId]
 * ジョブを更新（通知済み/破棄フラグ）
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const auth = await requireAuth();
        if (auth.error) return auth.error;

        const userId = auth.session.user.id;
        const { jobId } = await params;
        const body = await req.json();

        const container = await getContainer('PlanJobs');
        const dbError = checkDbContainer(container);
        if (dbError) return dbError;

        // 現在のジョブを取得
        const { resource: existingJob } = await container.item(jobId, userId).read();

        if (!existingJob) {
            return notFoundResponse('ジョブが見つかりません');
        }

        if (existingJob.userId !== userId) {
            return errorResponse('アクセス権がありません', 403);
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
        return errorResponse(`ジョブの更新に失敗しました: ${error.message}`);
    }
}
