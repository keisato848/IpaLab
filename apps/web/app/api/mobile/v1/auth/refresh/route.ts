/**
 * POST /api/mobile/v1/auth/refresh（詳細設計§5.2）
 * Refresh Tokenをローテーションし新しいトークンペアを返す。
 * 再利用検知時はtoken familyを全失効して401を返す。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { signAccessToken } from '@/lib/mobile/jwt';
import { rotateRefreshToken } from '@/lib/mobile/session-store';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const json = await request.json().catch(() => null);
        const parsed = Mobile.refreshRequestSchema.safeParse(json);
        if (!parsed.success) {
            return mobileErrorResponse(request, 400, 'INVALID_REQUEST', 'refreshTokenが必要です', false);
        }

        const result = await rotateRefreshToken(parsed.data.refreshToken);
        if (!result.ok) {
            const code =
                result.reason === 'reused'
                    ? 'TOKEN_REUSE_DETECTED'
                    : result.reason === 'expired'
                      ? 'REFRESH_TOKEN_EXPIRED'
                      : 'INVALID_REFRESH_TOKEN';
            return mobileErrorResponse(request, 401, code, '再ログインが必要です', false);
        }

        const { session, refreshToken } = result;
        const access = await signAccessToken({
            sub: session.userId,
            sid: session.id,
            role: session.authType === 'guest' ? 'guest' : 'user',
            auth_type: session.authType,
        });

        const body: Mobile.TokenPair = {
            accessToken: access.token,
            refreshToken,
            accessTokenExpiresAt: access.expiresAt.toISOString(),
            refreshTokenExpiresAt: session.absoluteExpiresAt,
        };
        return NextResponse.json(Mobile.tokenPairSchema.parse(body), {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (error) {
        console.error('[mobile/auth/refresh] failed:', error);
        return mobileErrorResponse(request, 500, 'REFRESH_FAILED', 'トークン更新に失敗しました', true);
    }
}
