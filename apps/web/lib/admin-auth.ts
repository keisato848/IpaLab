import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { NextResponse } from 'next/server';

/**
 * 管理者権限を検証するヘルパー
 *
 * @returns セッション情報、または権限エラーレスポンス
 */
export async function requireAdmin() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return {
            error: NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            ),
            session: null,
        };
    }

    if (session.user.role !== 'admin') {
        return {
            error: NextResponse.json(
                { error: '管理者権限が必要です' },
                { status: 403 }
            ),
            session: null,
        };
    }

    return { error: null, session };
}
