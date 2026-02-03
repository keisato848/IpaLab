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
    
    // 環境変数を取得（SWA では appsettings がランタイムで注入される）
    const connectionString = process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING 
        || process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
        || '';
    
    // デバッグ用: 環境変数の状態をログ出力
    console.log('[telemetry API] host:', host);
    console.log('[telemetry API] NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING:', 
        process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING ? 'SET' : 'NOT SET');
    console.log('[telemetry API] APPLICATIONINSIGHTS_CONNECTION_STRING:', 
        process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ? 'SET' : 'NOT SET');
    
    return NextResponse.json({
        connectionString,
        debug: {
            host,
            envVarStatus: {
                NEXT_PUBLIC: process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING ? 'SET' : 'NOT SET',
                STANDARD: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ? 'SET' : 'NOT SET',
            }
        }
    }, {
        headers: {
            // キャッシュなし（デバッグ用）
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}
