/**
 * POST /api/mobile/v1/guest/merge（詳細設計§5.3: ゲスト統合）
 * OAuthセッション必須。固定mergeIdで冪等、横取りは拒否。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { requireMobileSession } from '@/lib/mobile/auth-guard';
import { mergeGuest } from '@/lib/mobile/guest-merge';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const claims = await requireMobileSession(request);
        if (!claims) {
            return mobileErrorResponse(request, 401, 'UNAUTHORIZED', '認証が必要です', false);
        }
        if (claims.auth_type !== 'oauth') {
            return mobileErrorResponse(request, 403, 'OAUTH_REQUIRED', '正式アカウントでのログインが必要です', false);
        }

        const json = await request.json().catch(() => null);
        const parsed = Mobile.guestMergeRequestSchema.safeParse(json);
        if (!parsed.success) {
            return mobileErrorResponse(request, 400, 'INVALID_REQUEST', '統合要求が不正です', false);
        }

        const outcome = await mergeGuest(claims.sub, parsed.data);
        if (outcome.status === 'rejected') {
            const status = outcome.reason === 'invalid_credential' ? 401 : 409;
            const body: Mobile.GuestMergeResponse = {
                mergeId: parsed.data.mergeId,
                status: 'rejected',
                mergedEventCount: 0,
            };
            return NextResponse.json(Mobile.guestMergeResponseSchema.parse(body), {
                status,
                headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
            });
        }

        const body: Mobile.GuestMergeResponse = {
            mergeId: parsed.data.mergeId,
            status: outcome.status,
            mergedEventCount: outcome.mergedEventCount,
        };
        return NextResponse.json(Mobile.guestMergeResponseSchema.parse(body), {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (error) {
        console.error('[mobile/guest/merge] failed:', error);
        return mobileErrorResponse(request, 500, 'MERGE_FAILED', 'ゲスト統合に失敗しました', true);
    }
}
