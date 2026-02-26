import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { getContainer } from '@/lib/cosmos';

/**
 * POST /api/admin/setup
 * 初回管理者セットアップ
 *
 * 条件:
 * - 認証済みユーザーであること
 * - まだ管理者が一人もいないこと
 * - セットアップトークンが一致すること
 *
 * Body: { setupToken: string }
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json(
            { error: '認証が必要です' },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const { setupToken } = body;

        // 環境変数のセットアップトークンと照合
        const expectedToken = process.env.ADMIN_SETUP_TOKEN;
        if (!expectedToken) {
            return NextResponse.json(
                { error: 'セットアップトークンが設定されていません。環境変数 ADMIN_SETUP_TOKEN を設定してください。' },
                { status: 503 }
            );
        }

        if (setupToken !== expectedToken) {
            return NextResponse.json(
                { error: 'セットアップトークンが一致しません' },
                { status: 403 }
            );
        }

        const container = await getContainer('Users');
        if (!container) {
            return NextResponse.json(
                { error: 'データベースに接続できません' },
                { status: 503 }
            );
        }

        // 既に管理者が存在するか確認
        const { resources: admins } = await container.items
            .query({ query: "SELECT * FROM c WHERE c.role = 'admin'" })
            .fetchAll();

        if (admins.length > 0) {
            return NextResponse.json(
                { error: '管理者は既に存在します。追加の管理者は管理画面から設定してください。' },
                { status: 409 }
            );
        }

        // 現在のユーザーを管理者に昇格
        const { resource: user } = await container.item(session.user.id, session.user.id).read();
        if (!user) {
            return NextResponse.json(
                { error: 'ユーザーが見つかりません' },
                { status: 404 }
            );
        }

        const updated = { ...user, role: 'admin' };
        await container.items.upsert(updated);

        return NextResponse.json({
            message: '管理者として設定されました。再ログインしてください。',
            user: {
                id: session.user.id,
                email: session.user.email,
                role: 'admin',
            },
        });
    } catch (err) {
        console.error('[Admin Setup] エラー:', err);
        return NextResponse.json(
            { error: '管理者セットアップに失敗しました' },
            { status: 500 }
        );
    }
}
