/**
 * GET /api/mobile/v1/auth/me（詳細設計§6: Session確認）
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { requireMobileSession } from '@/lib/mobile/auth-guard';
import { findSessionById } from '@/lib/mobile/session-store';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const claims = await requireMobileSession(request);
        if (!claims) {
            return mobileErrorResponse(request, 401, 'UNAUTHORIZED', '認証が必要です', false);
        }
        const session = await findSessionById(claims.sid);
        const body: Mobile.SessionInfo = {
            userId: claims.sub,
            authType: claims.auth_type,
            provider: session?.provider as Mobile.SessionInfo['provider'],
            sessionId: claims.sid,
        };
        return NextResponse.json(Mobile.sessionInfoSchema.parse(body), {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (error) {
        console.error('[mobile/auth/me] failed:', error);
        return mobileErrorResponse(request, 500, 'ME_FAILED', 'セッション確認に失敗しました', true);
    }
}
