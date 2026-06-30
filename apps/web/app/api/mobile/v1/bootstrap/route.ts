/**
 * GET /api/mobile/v1/bootstrap（詳細設計§6）
 * 起動時に必要な初期データ（contentVersion、cursor、feature flags）を返す。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { buildContentManifest } from '@/lib/mobile/content';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

/** モバイル最低サポートバージョン。これ未満のアプリには更新を促す。 */
const MIN_SUPPORTED_APP_VERSION = '0.1.0';

export async function GET(request: NextRequest) {
    try {
        const manifest = await buildContentManifest();
        const body: Mobile.BootstrapResponse = {
            contentVersion: manifest.contentVersion,
            // 同期API実装（WP-2.5）までcursorは常にnull
            syncCursor: null,
            // フラグ配信はWP-4で feature-flags 基盤へ接続する（v0は空）
            featureFlags: {},
            minSupportedAppVersion: MIN_SUPPORTED_APP_VERSION,
            serverTime: new Date().toISOString(),
        };
        return NextResponse.json(Mobile.bootstrapResponseSchema.parse(body), {
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (error) {
        console.error('[mobile/bootstrap] failed:', error);
        return mobileErrorResponse(request, 500, 'BOOTSTRAP_FAILED', '初期データの取得に失敗しました', true);
    }
}
