import { NextResponse } from 'next/server';

// SWA ランタイムで環境変数を取得するため、動的レンダリングを強制
export const dynamic = 'force-dynamic';

/**
 * Application Insights の接続文字列を返す API エンドポイント
 * 
 * クライアントサイドから呼び出され、SWA ランタイム環境変数を取得可能にする
 * セキュリティ: 接続文字列は公開情報として扱われる（Instrumentation Key は公開可）
 */
export async function GET() {
    const connectionString = process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING 
        || process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
        || '';
    
    return NextResponse.json({
        connectionString,
    }, {
        headers: {
            // キャッシュ: 1時間（環境変数は頻繁に変わらない）
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
}
