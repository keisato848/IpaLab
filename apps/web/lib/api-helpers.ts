/**
 * API ヘルパー関数
 * 認証チェック、エラーハンドリング、レスポンスフォーマットの共通化
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { Session } from 'next-auth';

/**
 * 認証チェックを行い、セッションを返す
 * @returns セッション情報、または認証エラーレスポンス
 */
export async function requireAuth(): Promise<
    | { session: Session; error: null }
    | { session: null; error: NextResponse }
> {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
        return {
            session: null,
            error: NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            )
        };
    }
    
    return { session, error: null };
}

/**
 * データベース接続エラーのレスポンスを返す
 */
export function dbNotInitializedError(): NextResponse {
    return NextResponse.json(
        { error: 'データベース接続エラー' },
        { status: 500 }
    );
}

/**
 * データベースコンテナが初期化されていない場合のエラーチェック
 */
export function checkDbContainer(container: any): NextResponse | null {
    if (!container) {
        return dbNotInitializedError();
    }
    return null;
}

/**
 * 一般的なエラーレスポンスを返す
 */
export function errorResponse(
    message: string,
    status: number = 500
): NextResponse {
    return NextResponse.json({ error: message }, { status });
}

/**
 * 成功レスポンスを返す
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
    return NextResponse.json(data, { status });
}

/**
 * 404 Not Found レスポンスを返す
 */
export function notFoundResponse(message: string = 'リソースが見つかりません'): NextResponse {
    return NextResponse.json({ error: message }, { status: 404 });
}
