import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// SWA ランタイムで環境変数を取得するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Application Insights の接続文字列を返す API エンドポイント
 * 
 * クライアントサイドから呼び出され、SWA ランタイム環境変数を取得可能にする
 * セキュリティ: 接続文字列は公開情報として扱われる（Instrumentation Key は公開可）
 */
export async function GET() {
    // headers() を呼び出して動的レンダリングを確実に強制
    const headersList = await headers();
    const host = headersList.get('host') || 'unknown';
    
    // 環境変数を取得
    // TELEMETRY_CONNECTION_STRING: IPA コードレスエージェントが認識しないカスタム名
    const connectionString = process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING
        || process.env.TELEMETRY_CONNECTION_STRING
        || '';

    return NextResponse.json({
        connectionString,
    }, {
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}
