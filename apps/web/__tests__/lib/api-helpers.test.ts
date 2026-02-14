/**
 * API ヘルパー関数のテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    requireAuth,
    dbNotInitializedError,
    checkDbContainer,
    errorResponse,
    successResponse,
    notFoundResponse
} from '@/lib/api-helpers';
import { getServerSession } from 'next-auth';

// next-auth をモック
vi.mock('next-auth', () => ({
    getServerSession: vi.fn()
}));

// authOptions をモック
vi.mock('@/auth', () => ({
    authOptions: {}
}));

describe('api-helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('requireAuth', () => {
        it('認証済みセッションを返す', async () => {
            const mockSession = {
                user: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
                expires: '2025-12-31'
            };
            vi.mocked(getServerSession).mockResolvedValue(mockSession);

            const result = await requireAuth();

            expect(result.session).toEqual(mockSession);
            expect(result.error).toBeNull();
        });

        it('セッションがない場合は401エラーを返す', async () => {
            vi.mocked(getServerSession).mockResolvedValue(null);

            const result = await requireAuth();

            expect(result.session).toBeNull();
            expect(result.error).toBeDefined();
            
            // レスポンスの検証
            const json = await result.error!.json();
            expect(json).toEqual({ error: '認証が必要です' });
            expect(result.error!.status).toBe(401);
        });

        it('ユーザーIDがない場合は401エラーを返す', async () => {
            const mockSession = {
                user: { name: 'Test User' }, // id が欠落
                expires: '2025-12-31'
            };
            vi.mocked(getServerSession).mockResolvedValue(mockSession as any);

            const result = await requireAuth();

            expect(result.session).toBeNull();
            expect(result.error).toBeDefined();
        });
    });

    describe('dbNotInitializedError', () => {
        it('500エラーレスポンスを返す', async () => {
            const response = dbNotInitializedError();
            
            const json = await response.json();
            expect(json).toEqual({ error: 'データベース接続エラー' });
            expect(response.status).toBe(500);
        });
    });

    describe('checkDbContainer', () => {
        it('コンテナがnullの場合はエラーレスポンスを返す', () => {
            const result = checkDbContainer(null);
            
            expect(result).toBeDefined();
            expect(result!.status).toBe(500);
        });

        it('コンテナがundefinedの場合はエラーレスポンスを返す', () => {
            const result = checkDbContainer(undefined);
            
            expect(result).toBeDefined();
            expect(result!.status).toBe(500);
        });

        it('コンテナが有効な場合はnullを返す', () => {
            const mockContainer = { items: {} };
            const result = checkDbContainer(mockContainer);
            
            expect(result).toBeNull();
        });
    });

    describe('errorResponse', () => {
        it('カスタムエラーメッセージとステータスコードを返す', async () => {
            const response = errorResponse('カスタムエラー', 400);
            
            const json = await response.json();
            expect(json).toEqual({ error: 'カスタムエラー' });
            expect(response.status).toBe(400);
        });

        it('デフォルトで500ステータスを返す', async () => {
            const response = errorResponse('エラー');
            
            expect(response.status).toBe(500);
        });
    });

    describe('successResponse', () => {
        it('データと200ステータスを返す', async () => {
            const data = { id: '123', name: 'Test' };
            const response = successResponse(data);
            
            const json = await response.json();
            expect(json).toEqual(data);
            expect(response.status).toBe(200);
        });

        it('カスタムステータスコードを返す', async () => {
            const data = { created: true };
            const response = successResponse(data, 201);
            
            expect(response.status).toBe(201);
        });
    });

    describe('notFoundResponse', () => {
        it('404エラーレスポンスを返す', async () => {
            const response = notFoundResponse();
            
            const json = await response.json();
            expect(json).toEqual({ error: 'リソースが見つかりません' });
            expect(response.status).toBe(404);
        });

        it('カスタムメッセージを返す', async () => {
            const response = notFoundResponse('ユーザーが見つかりません');
            
            const json = await response.json();
            expect(json).toEqual({ error: 'ユーザーが見つかりません' });
        });
    });
});
