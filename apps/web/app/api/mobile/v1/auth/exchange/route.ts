/**
 * POST /api/mobile/v1/auth/exchange（詳細設計§5.1: bridge code交換）
 * 一回限りのbridge codeとPKCE verifierを検証しMobile sessionを発行する。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { consumeBridgeCode } from '@/lib/mobile/auth-transaction';
import { createSession } from '@/lib/mobile/session-store';
import { signAccessToken } from '@/lib/mobile/jwt';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const json = await request.json().catch(() => null);
        const parsed = Mobile.exchangeRequestSchema.safeParse(json);
        if (!parsed.success) {
            return mobileErrorResponse(request, 400, 'INVALID_REQUEST', '交換要求が不正です', false);
        }

        const outcome = await consumeBridgeCode(parsed.data.bridgeCode, parsed.data.codeVerifier);
        if (!outcome.ok) {
            const code =
                outcome.reason === 'pkce_mismatch'
                    ? 'PKCE_MISMATCH'
                    : outcome.reason === 'expired'
                      ? 'BRIDGE_CODE_EXPIRED'
                      : 'INVALID_BRIDGE_CODE';
            return mobileErrorResponse(request, 401, code, '認証をやり直してください', false);
        }

        const { session, refreshToken } = await createSession({
            userId: outcome.userId,
            authType: 'oauth',
            provider: outcome.provider,
        });
        const access = await signAccessToken({
            sub: outcome.userId,
            sid: session.id,
            role: 'user',
            auth_type: 'oauth',
        });

        const body: Mobile.ExchangeResponse = {
            tokens: {
                accessToken: access.token,
                refreshToken,
                accessTokenExpiresAt: access.expiresAt.toISOString(),
                refreshTokenExpiresAt: session.absoluteExpiresAt,
            },
            user: { userId: outcome.userId, provider: outcome.provider },
        };
        return NextResponse.json(Mobile.exchangeResponseSchema.parse(body), {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (error) {
        console.error('[mobile/auth/exchange] failed:', error);
        return mobileErrorResponse(request, 500, 'EXCHANGE_FAILED', 'セッション確立に失敗しました', true);
    }
}
