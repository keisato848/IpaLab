/**
 * GET /api/mobile/v1/sync/changes（詳細設計§6: サーバー差分pull）
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { requireMobileSession } from '@/lib/mobile/auth-guard';
import { fetchChanges } from '@/lib/mobile/sync-store';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const claims = await requireMobileSession(request);
        if (!claims) {
            return mobileErrorResponse(request, 401, 'UNAUTHORIZED', '認証が必要です', false);
        }

        const { searchParams } = new URL(request.url);
        const parsed = Mobile.syncChangesQuerySchema.safeParse({
            cursor: searchParams.get('cursor') ?? undefined,
            limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
        });
        if (!parsed.success) {
            return mobileErrorResponse(request, 400, 'INVALID_QUERY', 'クエリが不正です', false);
        }

        const body = await fetchChanges(claims.sub, parsed.data.cursor, parsed.data.limit);
        return NextResponse.json(body, {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (error) {
        console.error('[mobile/sync/changes] failed:', error);
        return mobileErrorResponse(request, 500, 'CHANGES_FAILED', '差分取得に失敗しました', true);
    }
}
