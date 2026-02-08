import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// CosmosDBのモック
vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn(),
}));

describe('/api/exams/[examId]/questions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('正常に問題一覧を取得する', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            const mockQuestions = [
                { id: 'q1', qNo: 1, text: '問題1', examId: 'AP-2024-Spring-AM', category: 'セキュリティ' },
                { id: 'q2', qNo: 2, text: '問題2', examId: 'AP-2024-Spring-AM', category: 'ネットワーク' },
            ];

            (getContainer as any).mockResolvedValue({
                items: {
                    query: () => ({
                        fetchAll: async () => ({ resources: mockQuestions }),
                    }),
                },
            });

            const { GET } = await import('@/app/api/exams/[examId]/questions/route');
            const request = new NextRequest('http://localhost:3000/api/exams/AP-2024-Spring-AM/questions');
            const response = await GET(request, { params: Promise.resolve({ examId: 'AP-2024-Spring-AM' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toHaveLength(2);
            expect(data[0].qNo).toBe(1);
            expect(data[1].qNo).toBe(2);
        });

        it('categoryが欠けている場合はデフォルト値を設定する', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            const mockQuestions = [
                { id: 'q1', qNo: 1, text: '問題1', examId: 'AP-2024-Spring-AM' }, // categoryなし
            ];

            (getContainer as any).mockResolvedValue({
                items: {
                    query: () => ({
                        fetchAll: async () => ({ resources: mockQuestions }),
                    }),
                },
            });

            const { GET } = await import('@/app/api/exams/[examId]/questions/route');
            const request = new NextRequest('http://localhost:3000/api/exams/AP-2024-Spring-AM/questions');
            const response = await GET(request, { params: Promise.resolve({ examId: 'AP-2024-Spring-AM' }) });
            const data = await response.json();

            expect(data[0].category).toBe('AP'); // examIdのprefixがフォールバック
            expect(data[0].subCategory).toBe('その他'); // デフォルト値
        });

        it('subCategoryが欠けている場合はデフォルト値を設定する', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            const mockQuestions = [
                { id: 'q1', qNo: 1, text: '問題1', examId: 'FE-2024-Fall-AM', category: 'セキュリティ' },
            ];

            (getContainer as any).mockResolvedValue({
                items: {
                    query: () => ({
                        fetchAll: async () => ({ resources: mockQuestions }),
                    }),
                },
            });

            const { GET } = await import('@/app/api/exams/[examId]/questions/route');
            const request = new NextRequest('http://localhost:3000/api/exams/FE-2024-Fall-AM/questions');
            const response = await GET(request, { params: Promise.resolve({ examId: 'FE-2024-Fall-AM' }) });
            const data = await response.json();

            expect(data[0].subCategory).toBe('その他');
        });

        it('DBが未初期化の場合は500を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(null);

            const { GET } = await import('@/app/api/exams/[examId]/questions/route');
            const request = new NextRequest('http://localhost:3000/api/exams/AP-2024-Spring-AM/questions');
            const response = await GET(request, { params: Promise.resolve({ examId: 'AP-2024-Spring-AM' }) });

            expect(response.status).toBe(500);
        });

        it('クエリエラー時は500を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue({
                items: {
                    query: () => ({
                        fetchAll: async () => { throw new Error('Query failed'); },
                    }),
                },
            });

            const { GET } = await import('@/app/api/exams/[examId]/questions/route');
            const request = new NextRequest('http://localhost:3000/api/exams/AP-2024-Spring-AM/questions');
            const response = await GET(request, { params: Promise.resolve({ examId: 'AP-2024-Spring-AM' }) });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Internal Server Error');
        });

        it('空の結果も正常に返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue({
                items: {
                    query: () => ({
                        fetchAll: async () => ({ resources: [] }),
                    }),
                },
            });

            const { GET } = await import('@/app/api/exams/[examId]/questions/route');
            const request = new NextRequest('http://localhost:3000/api/exams/nonexistent/questions');
            const response = await GET(request, { params: Promise.resolve({ examId: 'nonexistent' }) });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });
    });
});
