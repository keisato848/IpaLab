import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { getContainer } from '@/lib/cosmos';

export const dynamic = 'force-dynamic';

/**
 * POST /api/track
 * ページビューを記録（匿名・認証ユーザー両方対応）
 *
 * Body:
 * - visitorId: string (クライアント側で生成した匿名ID)
 * - path: string (閲覧ページのパス)
 */
export async function POST(request: NextRequest) {
    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'リクエストボディが不正です' },
                { status: 400 }
            );
        }
        const { visitorId, path } = body;

        if (!visitorId || !path) {
            return NextResponse.json(
                { error: 'visitorId と path は必須です' },
                { status: 400 }
            );
        }

        // セッションがあれば認証ユーザー
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id || null;
        const isAuthenticated = !!userId;

        const now = new Date();
        const date = now.toISOString().slice(0, 10); // YYYY-MM-DD

        const container = await getContainer('PageViews');
        if (!container) {
            // DB 未初期化の場合は静かに成功を返す
            return NextResponse.json({ ok: true });
        }

        await container.items.create({
            id: `${visitorId}-${Date.now()}`,
            visitorId,
            userId,
            isAuthenticated,
            path,
            date,
            timestamp: now.toISOString(),
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        // トラッキングエラーはユーザー体験に影響させない
        console.error('[Track] エラー:', err);
        return NextResponse.json({ ok: true });
    }
}
