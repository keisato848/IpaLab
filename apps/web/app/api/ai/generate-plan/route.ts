import { NextResponse } from 'next/server';

// APIルートは動的レンダリングを強制
export const dynamic = 'force-dynamic';

/**
 * @deprecated このルートは `/api/ai/plan` に移行済み。フロントエンドから呼ばれていない。
 * US リージョン Azure Function プロキシ経由の正式実装は `/api/ai/plan/route.ts` を参照。
 * 削除時期: 次回メジャーリリース（既存APIコールがないため安全に削除可能）
 */
export async function POST() {
    return NextResponse.json(
        { error: 'This endpoint is deprecated. Use /api/ai/plan instead.' },
        { status: 410 },
    );
}
