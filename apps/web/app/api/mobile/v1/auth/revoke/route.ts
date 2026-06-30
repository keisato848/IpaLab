/**
 * POST /api/mobile/v1/auth/revoke（詳細設計§6 / 基本設計§8.2: ログアウト時にサーバートークン失効）
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireMobileSession } from '@/lib/mobile/auth-guard';
import { revokeSession } from '@/lib/mobile/session-store';
import { mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const claims = await requireMobileSession(request);
        if (!claims) {
            return mobileErrorResponse(request, 401, 'UNAUTHORIZED', '認証が必要です', false);
        }
        await revokeSession(claims.sid);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('[mobile/auth/revoke] failed:', error);
        return mobileErrorResponse(request, 500, 'REVOKE_FAILED', 'ログアウトに失敗しました', true);
    }
}
