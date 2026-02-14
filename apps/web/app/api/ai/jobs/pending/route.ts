/**
 * Pending Jobs API
 * GET /api/ai/jobs/pending - 完了済みで未通知のジョブを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/cosmos';
import { requireAuth, checkDbContainer, errorResponse } from '@/lib/api-helpers';

// 認証を使用するため動的レンダリングを強制
export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/jobs/pending
 * 完了済みで未通知のジョブを取得（ダッシュボード通知用）
 */
export async function GET(req: NextRequest) {
    try {
        // 認証チェック
        const auth = await requireAuth();
        if (auth.error) return auth.error;

        const userId = auth.session.user.id;

        const container = await getContainer('PlanJobs');
        const dbError = checkDbContainer(container);
        if (dbError) return dbError;

        // 完了済みで、通知されていない、破棄されていないジョブを取得
        const { resources } = await container.items
            .query({
                query: `
                    SELECT * FROM c 
                    WHERE c.userId = @userId 
                      AND c.status = 'completed'
                      AND (NOT IS_DEFINED(c.notifiedAt) OR c.notifiedAt = null)
                      AND (NOT IS_DEFINED(c.dismissed) OR c.dismissed = false)
                    ORDER BY c.completedAt DESC
                `,
                parameters: [{ name: '@userId', value: userId }],
            })
            .fetchAll();

        return NextResponse.json(resources);

    } catch (error: any) {
        console.error('Failed to get pending jobs:', error);
        return errorResponse(`完了ジョブの取得に失敗しました: ${error.message}`);
    }
}
