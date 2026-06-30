/**
 * POST /api/mobile/v1/auth/authorize（詳細設計§5.1: OAuth開始）
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { createAuthTransaction } from '@/lib/mobile/auth-transaction';
import { buildAuthorizationUrl } from '@/lib/mobile/oauth-providers';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const json = await request.json().catch(() => null);
        const parsed = Mobile.authorizeRequestSchema.safeParse(json);
        if (!parsed.success) {
            return mobileErrorResponse(request, 400, 'INVALID_REQUEST', '認可要求が不正です', false);
        }

        const { provider, codeChallenge, state } = parsed.data;
        const txn = await createAuthTransaction({ provider, codeChallenge, clientState: state });
        const body: Mobile.AuthorizeResponse = {
            authorizationUrl: buildAuthorizationUrl(provider, txn.serverState),
            transactionId: txn.transactionId,
            expiresAt: txn.expiresAt,
        };
        return NextResponse.json(Mobile.authorizeResponseSchema.parse(body), {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (error) {
        console.error('[mobile/auth/authorize] failed:', error);
        return mobileErrorResponse(request, 500, 'AUTHORIZE_FAILED', '認可開始に失敗しました', true);
    }
}
