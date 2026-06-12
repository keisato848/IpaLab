/**
 * GET /api/mobile/v1/content/manifest（詳細設計§6）
 * コンテンツ差分一覧。contentVersionをETagとして返し、If-None-Matchで304を返す。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { buildContentManifest } from '@/lib/mobile/content';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const manifest = await buildContentManifest();
        const etag = `"${manifest.contentVersion}"`;

        if (request.headers.get('if-none-match') === etag) {
            return new NextResponse(null, {
                status: 304,
                headers: { ETag: etag },
            });
        }

        return NextResponse.json(manifest, {
            headers: {
                ETag: etag,
                [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request),
            },
        });
    } catch (error) {
        console.error('[mobile/content/manifest] failed:', error);
        return mobileErrorResponse(request, 500, 'MANIFEST_FAILED', 'コンテンツ一覧の取得に失敗しました', true);
    }
}
