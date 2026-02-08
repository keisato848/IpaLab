import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// getContainerのモック
vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn(),
}));

describe('/api/exam-progress', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('GET', () => {
        it('userIdが未指定の場合は400を返す', async () => {
            const { GET } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress?examId=exam-1');

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('userId and examId required');
        });

        it('examIdが未指定の場合は400を返す', async () => {
            const { GET } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress?userId=user-1');

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('userId and examId required');
        });

        it('既存の進捗を取得できる', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            const mockProgress = {
                id: 'user-1-exam-1',
                userId: 'user-1',
                examId: 'exam-1',
                bookmarks: ['q1', 'q2'],
                statusMap: { q1: { isCorrect: true, answeredAt: '2026-01-01T00:00:00Z' } },
                updatedAt: '2026-01-01T00:00:00Z',
            };

            (getContainer as any).mockResolvedValue({
                item: () => ({
                    read: () => Promise.resolve({ resource: mockProgress }),
                }),
            });

            const { GET } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress?userId=user-1&examId=exam-1');

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.bookmarks).toEqual(['q1', 'q2']);
        });

        it('進捗が見つからない場合は空の進捗を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                item: () => ({
                    read: () => Promise.resolve({ resource: null }),
                }),
            });

            const { GET } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress?userId=user-1&examId=exam-1');

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.bookmarks).toEqual([]);
            expect(data.statusMap).toEqual({});
        });

        it('404エラー時は空の進捗を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                item: () => ({
                    read: () => Promise.reject({ code: 404 }),
                }),
            });

            const { GET } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress?userId=user-1&examId=exam-1');

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.bookmarks).toEqual([]);
        });

        it('DBエラー時は500を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                item: () => ({
                    read: () => Promise.reject({ code: 500, message: 'DB Error' }),
                }),
            });

            const { GET } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress?userId=user-1&examId=exam-1');

            const response = await GET(request);

            expect(response.status).toBe(500);
        });

        it('DB未初期化時は500を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(null);

            const { GET } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress?userId=user-1&examId=exam-1');

            const response = await GET(request);

            expect(response.status).toBe(500);
        });
    });

    describe('POST', () => {
        it('userIdが未指定の場合は400を返す', async () => {
            const { POST } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress', {
                method: 'POST',
                body: JSON.stringify({ examId: 'exam-1' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('userId and examId required');
        });

        it('examIdが未指定の場合は400を返す', async () => {
            const { POST } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress', {
                method: 'POST',
                body: JSON.stringify({ userId: 'user-1' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('userId and examId required');
        });

        it('既存の進捗を更新できる', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            const existingProgress = {
                id: 'user-1-exam-1',
                userId: 'user-1',
                examId: 'exam-1',
                bookmarks: ['q1'],
                statusMap: {},
                updatedAt: '2026-01-01T00:00:00Z',
            };

            (getContainer as any).mockResolvedValue({
                item: () => ({
                    read: () => Promise.resolve({ resource: existingProgress }),
                }),
                items: {
                    upsert: (data: any) => Promise.resolve({ resource: data }),
                },
            });

            const { POST } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress', {
                method: 'POST',
                body: JSON.stringify({
                    userId: 'user-1',
                    examId: 'exam-1',
                    bookmarks: ['q1', 'q2', 'q3'],
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.bookmarks).toEqual(['q1', 'q2', 'q3']);
        });

        it('新規進捗を作成できる（resourceがnull）', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                item: () => ({
                    read: () => Promise.resolve({ resource: null }),
                }),
                items: {
                    upsert: (data: any) => Promise.resolve({ resource: data }),
                },
            });

            const { POST } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress', {
                method: 'POST',
                body: JSON.stringify({
                    userId: 'user-1',
                    examId: 'exam-1',
                    bookmarks: ['q1'],
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.bookmarks).toEqual(['q1']);
        });

        it('新規進捗を作成できる（readエラー時）', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                item: () => ({
                    read: () => Promise.reject(new Error('Not found')),
                }),
                items: {
                    upsert: (data: any) => Promise.resolve({ resource: data }),
                },
            });

            const { POST } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress', {
                method: 'POST',
                body: JSON.stringify({
                    userId: 'user-1',
                    examId: 'exam-1',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.bookmarks).toEqual([]);
        });

        it('statusUpdateで回答状態を更新できる', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            const existingProgress = {
                id: 'user-1-exam-1',
                userId: 'user-1',
                examId: 'exam-1',
                bookmarks: [],
                statusMap: {},
                updatedAt: '2026-01-01T00:00:00Z',
            };

            (getContainer as any).mockResolvedValue({
                item: () => ({
                    read: () => Promise.resolve({ resource: existingProgress }),
                }),
                items: {
                    upsert: (data: any) => Promise.resolve({ resource: data }),
                },
            });

            const { POST } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress', {
                method: 'POST',
                body: JSON.stringify({
                    userId: 'user-1',
                    examId: 'exam-1',
                    statusUpdate: {
                        questionId: 'q1',
                        isCorrect: true,
                    },
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.statusMap.q1.isCorrect).toBe(true);
        });

        it('DB未初期化時は500を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(null);

            const { POST } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress', {
                method: 'POST',
                body: JSON.stringify({
                    userId: 'user-1',
                    examId: 'exam-1',
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(500);
        });

        it('upsertエラー時は500を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                item: () => ({
                    read: () => Promise.resolve({ resource: null }),
                }),
                items: {
                    upsert: () => Promise.reject(new Error('Upsert failed')),
                },
            });

            const { POST } = await import('@/app/api/exam-progress/route');
            const request = new NextRequest('http://localhost:3000/api/exam-progress', {
                method: 'POST',
                body: JSON.stringify({
                    userId: 'user-1',
                    examId: 'exam-1',
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(500);
        });
    });
});
