import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// crypto.randomUUIDのモック
const mockUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
vi.stubGlobal('crypto', {
    ...crypto,
    randomUUID: () => mockUUID
});

// CosmosDBのモック
vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn()
}));

// next-authのモック
vi.mock('next-auth', () => ({
    getServerSession: vi.fn()
}));

vi.mock('@/auth', () => ({
    authOptions: {}
}));

describe('/api/learning-records POST', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('単一レコード挿入', () => {
        it('正常にレコードを作成する', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            const mockRecord = {
                userId: 'user-1',
                questionId: 'q1',
                examId: 'AP-2024-Spring',
                category: 'セキュリティ',
                isCorrect: true,
            };

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mockRecord)
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.userId).toBe('user-1');
            expect(data.id).toBe(mockUUID);
        });

        it('idがない場合は自動生成する', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    questionId: 'q1',
                    examId: 'AP-2024-Spring',
                    category: 'セキュリティ'
                })
            });

            const response = await POST(request);
            const data = await response.json();

            expect(data.id).toBe(mockUUID);
        });

        it('answeredAtがない場合は自動生成する', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    questionId: 'q1',
                    examId: 'AP-2024-Spring',
                    category: 'セキュリティ'
                })
            });

            const response = await POST(request);
            const data = await response.json();

            expect(data.answeredAt).toBeDefined();
        });

        it('isDescriptive=trueでaiScore>=60の場合、isCorrect=true', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    questionId: 'q1',
                    examId: 'AP-2024-PM',
                    category: 'PM',
                    isDescriptive: true,
                    aiScore: 75
                })
            });

            const response = await POST(request);
            const data = await response.json();

            expect(data.isCorrect).toBe(true);
        });

        it('isDescriptive=trueでaiScore<60の場合、isCorrect=false', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    questionId: 'q1',
                    examId: 'AP-2024-PM',
                    category: 'PM',
                    isDescriptive: true,
                    aiScore: 50
                })
            });

            const response = await POST(request);
            const data = await response.json();

            expect(data.isCorrect).toBe(false);
        });

        it('isCorrectが未定義の場合はfalseにフォールバック', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    questionId: 'q1',
                    examId: 'AP-2024-Spring',
                    category: 'セキュリティ'
                    // isCorrectなし
                })
            });

            const response = await POST(request);
            const data = await response.json();

            expect(data.isCorrect).toBe(false);
        });

        it('isFlaggedが未定義の場合はfalseにフォールバック', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    questionId: 'q1',
                    examId: 'AP-2024-Spring',
                    category: 'セキュリティ'
                })
            });

            const response = await POST(request);
            const data = await response.json();

            expect(data.isFlagged).toBe(false);
        });

        it('sessionIdを含めて保存できる', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    questionId: 'q1',
                    examId: 'AP-2024-Spring',
                    category: 'セキュリティ',
                    sessionId: 'session-123'
                })
            });

            const response = await POST(request);
            const data = await response.json();

            expect(data.sessionId).toBe('session-123');
        });

        it('不正なデータの場合は400を返す', async () => {
            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // userIdがない
                    questionId: 'q1',
                    examId: 'AP-2024-Spring'
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
        });

        it('DBエラー時は500を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async () => { throw new Error('DB Error'); }
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    questionId: 'q1',
                    examId: 'AP-2024-Spring',
                    category: 'セキュリティ'
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(500);
        });

        it('DB未初期化時は500を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(null);

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user-1',
                    questionId: 'q1',
                    examId: 'AP-2024-Spring',
                    category: 'セキュリティ'
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(500);
        });
    });

    describe('バルクレコード挿入', () => {
        it('複数レコードを一括挿入する', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            const records = [
                { userId: 'user-1', questionId: 'q1', examId: 'AP-2024', category: 'cat1' },
                { userId: 'user-1', questionId: 'q2', examId: 'AP-2024', category: 'cat2' }
            ];

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(records)
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.count).toBe(2);
            expect(data.records).toHaveLength(2);
        });

        it('バルク挿入でisDescriptive分岐を処理する', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            const records = [
                { userId: 'user-1', questionId: 'q1', examId: 'AP-2024', category: 'PM', isDescriptive: true, aiScore: 80 },
                { userId: 'user-1', questionId: 'q2', examId: 'AP-2024', category: 'PM', isDescriptive: true, aiScore: 40 }
            ];

            (getContainer as any).mockResolvedValue({
                items: {
                    create: async (data: any) => ({ resource: data })
                }
            });

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(records)
            });

            const response = await POST(request);
            const data = await response.json();

            expect(data.records[0].isCorrect).toBe(true);
            expect(data.records[1].isCorrect).toBe(false);
        });

        it('バルク挿入で不正データは400を返す', async () => {
            const records = [
                { questionId: 'q1', examId: 'AP-2024', category: 'cat1' }, // userIdなし
            ];

            const { POST } = await import('@/app/api/learning-records/route');
            const request = new NextRequest('http://localhost:3000/api/learning-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(records)
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
        });
    });
});

describe('/api/learning-records GET', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('examIdでフィルタリングできる', async () => {
        const { getServerSession } = await import('next-auth');
        const { getContainer } = await import('@/lib/cosmos');

        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', name: 'Test' }
        });

        const mockRecords = [
            { id: 'r1', userId: 'user-1', examId: 'AP-2024-Spring' }
        ];

        (getContainer as any).mockResolvedValue({
            items: {
                query: () => ({
                    fetchAll: async () => ({ resources: mockRecords })
                })
            }
        });

        const { GET } = await import('@/app/api/learning-records/route');
        const request = new NextRequest('http://localhost:3000/api/learning-records?userId=user-1&examId=AP-2024-Spring');
        const response = await GET(request);

        expect(response.status).toBe(200);
    });

    it('questionIdでフィルタリングできる', async () => {
        const { getServerSession } = await import('next-auth');
        const { getContainer } = await import('@/lib/cosmos');

        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', name: 'Test' }
        });

        (getContainer as any).mockResolvedValue({
            items: {
                query: () => ({
                    fetchAll: async () => ({ resources: [] })
                })
            }
        });

        const { GET } = await import('@/app/api/learning-records/route');
        const request = new NextRequest('http://localhost:3000/api/learning-records?userId=user-1&questionId=q1');
        const response = await GET(request);

        expect(response.status).toBe(200);
    });

    it('examIdとquestionId両方でフィルタリングできる', async () => {
        const { getServerSession } = await import('next-auth');
        const { getContainer } = await import('@/lib/cosmos');

        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', name: 'Test' }
        });

        (getContainer as any).mockResolvedValue({
            items: {
                query: () => ({
                    fetchAll: async () => ({ resources: [] })
                })
            }
        });

        const { GET } = await import('@/app/api/learning-records/route');
        const request = new NextRequest('http://localhost:3000/api/learning-records?userId=user-1&examId=AP-2024&questionId=q1');
        const response = await GET(request);

        expect(response.status).toBe(200);
    });

    it('DBエラー時は500を返す', async () => {
        const { getServerSession } = await import('next-auth');
        const { getContainer } = await import('@/lib/cosmos');

        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', name: 'Test' }
        });

        (getContainer as any).mockResolvedValue({
            items: {
                query: () => ({
                    fetchAll: async () => { throw new Error('DB Error'); }
                })
            }
        });

        const { GET } = await import('@/app/api/learning-records/route');
        const request = new NextRequest('http://localhost:3000/api/learning-records?userId=user-1');
        const response = await GET(request);

        expect(response.status).toBe(500);
    });

    it('DB未初期化時は500を返す', async () => {
        const { getServerSession } = await import('next-auth');
        const { getContainer } = await import('@/lib/cosmos');

        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', name: 'Test' }
        });

        (getContainer as any).mockResolvedValue(null);

        const { GET } = await import('@/app/api/learning-records/route');
        const request = new NextRequest('http://localhost:3000/api/learning-records?userId=user-1');
        const response = await GET(request);

        expect(response.status).toBe(500);
    });
});
