/**
 * GET /api/mobile/v1/study-plans
 * 認証ユーザーの全学習計画一覧を返す。
 */
import { NextRequest } from 'next/server';
import { requireMobileSession } from '@/lib/mobile/auth-guard';
import { mobileErrorResponse, getCorrelationId } from '@/lib/mobile/error';
import { mobilePlanStore } from '@/lib/mobile/study-plans';
import { NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const claims = await requireMobileSession(request);
    if (!claims) {
        return mobileErrorResponse(request, 401, 'UNAUTHORIZED', 'Authentication required', false);
    }

    try {
        const plans = await mobilePlanStore.listByUser(claims.sub);
        const body: Mobile.StudyPlansListResponse = { plans };
        return NextResponse.json(body, {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (err) {
        console.error('[mobile/study-plans GET]', err);
        return mobileErrorResponse(request, 500, 'INTERNAL_ERROR', 'Internal server error', true);
    }
}
