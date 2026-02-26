import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAllFeatureFlags, updateFeatureFlag } from '@/lib/feature-flags';

/**
 * GET /api/admin/feature-flags
 * 全フィーチャーフラグを取得
 */
export async function GET() {
    const { error } = await requireAdmin();
    if (error) return error;

    try {
        const flags = await getAllFeatureFlags();
        return NextResponse.json({ flags });
    } catch (err) {
        console.error('[Admin API] フィーチャーフラグ取得エラー:', err);
        return NextResponse.json(
            { error: 'フィーチャーフラグの取得に失敗しました' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/feature-flags
 * フィーチャーフラグを更新
 *
 * Body: { id: string, enabled: boolean }
 */
export async function PATCH(request: Request) {
    const { error, session } = await requireAdmin();
    if (error) return error;

    try {
        const body = await request.json();
        const { id, enabled } = body;

        if (!id || typeof enabled !== 'boolean') {
            return NextResponse.json(
                { error: 'id (string) と enabled (boolean) が必要です' },
                { status: 400 }
            );
        }

        const updated = await updateFeatureFlag(id, enabled, session!.user.id);

        if (!updated) {
            return NextResponse.json(
                { error: 'フィーチャーフラグの更新に失敗しました' },
                { status: 500 }
            );
        }

        return NextResponse.json({ flag: updated });
    } catch (err) {
        console.error('[Admin API] フィーチャーフラグ更新エラー:', err);
        return NextResponse.json(
            { error: 'フィーチャーフラグの更新に失敗しました' },
            { status: 500 }
        );
    }
}
