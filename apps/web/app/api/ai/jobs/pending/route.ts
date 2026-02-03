/**
 * Pending Jobs API
 * GET /api/ai/jobs/pending - 完了済みで未通知のジョブを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { getContainer } from '@/lib/cosmos';

/**
 * GET /api/ai/jobs/pending
 * 完了済みで未通知のジョブを取得（ダッシュボード通知用）
 */
export async function GET(req: NextRequest) {
    try {
        // 認証チェック
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }

        const userId = session.user.id;

        const container = await getContainer('PlanJobs');
        if (!container) {
            return NextResponse.json({ error: 'データベース接続エラー' }, { status: 500 });
        }

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
        return NextResponse.json({
            error: '完了ジョブの取得に失敗しました',
            details: error.message,
        }, { status: 500 });
    }
}
