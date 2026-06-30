/**
 * POST /api/mobile/v1/sync/batch（詳細設計§6 / §8: Outbox部分ACK同期）
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { requireMobileSession } from '@/lib/mobile/auth-guard';
import { applySyncBatch } from '@/lib/mobile/sync-store';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const claims = await requireMobileSession(request);
        if (!claims) {
            return mobileErrorResponse(request, 401, 'UNAUTHORIZED', '認証が必要です', false);
        }

        const json = await request.json().catch(() => null);
        const parsed = Mobile.syncBatchRequestSchema.safeParse(json);
        if (!parsed.success) {
            return mobileErrorResponse(
                request,
                400,
                'INVALID_BATCH',
                `同期バッチが不正です（1〜${Mobile.SYNC_BATCH_MAX_EVENTS}件のeventsが必要）`,
                false
            );
        }

        // 認可の正本はJWTのsub（payload内のuserIdは使用しない）
        const results = await applySyncBatch(claims.sub, parsed.data.events);
        const body: Mobile.SyncBatchResponse = {
            results,
            serverTime: new Date().toISOString(),
        };
        return NextResponse.json(Mobile.syncBatchResponseSchema.parse(body), {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (error) {
        console.error('[mobile/sync/batch] failed:', error);
        return mobileErrorResponse(request, 500, 'SYNC_FAILED', '同期に失敗しました', true);
    }
}
