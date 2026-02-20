import { NextResponse } from 'next/server';
import { getAllFeatureFlags } from '@/lib/feature-flags';

/**
 * GET /api/feature-flags
 * フィーチャーフラグの公開情報を取得（認証不要・読み取り専用）
 *
 * レスポンス: { flags: { [id]: boolean } }
 */
export async function GET() {
    try {
        const allFlags = await getAllFeatureFlags();

        // クライアントには id と enabled のマップのみを返す
        const flagMap: Record<string, boolean> = {};
        for (const flag of allFlags) {
            flagMap[flag.id] = flag.enabled;
        }

        return NextResponse.json(
            { flags: flagMap },
            {
                headers: {
                    // 30秒キャッシュ（頻繁なAPI呼び出しを防止）
                    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
                },
            }
        );
    } catch (err) {
        console.error('[Feature Flags API] 取得エラー:', err);
        return NextResponse.json(
            { flags: {} },
            { status: 500 }
        );
    }
}
