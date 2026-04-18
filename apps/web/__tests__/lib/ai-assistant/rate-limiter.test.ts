import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn(),
}));

describe('rate-limiter', () => {
    let mockContainer: any;

    beforeEach(() => {
        vi.useRealTimers();
        vi.resetModules();
        vi.clearAllMocks();
        mockContainer = {
            items: {
                query: vi.fn(() => ({
                    fetchAll: vi.fn().mockResolvedValue({ resources: [0] }),
                })),
                create: vi.fn().mockResolvedValue({}),
            },
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('checkRateLimit', () => {
        it('使用回数が上限未満の場合は allowed: true を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(mockContainer);
            mockContainer.items.query.mockReturnValue({
                fetchAll: vi.fn().mockResolvedValue({ resources: [5] }),
            });

            const { checkRateLimit } = await import('@/lib/ai-assistant/rate-limiter');
            const result = await checkRateLimit('user-1');

            expect(result.allowed).toBe(true);
            expect(result.used).toBe(5);
            expect(result.remaining).toBe(5);
        });

        it('使用回数が上限の場合は allowed: false を返す', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(mockContainer);
            mockContainer.items.query.mockReturnValue({
                fetchAll: vi.fn().mockResolvedValue({ resources: [10] }),
            });

            const { checkRateLimit } = await import('@/lib/ai-assistant/rate-limiter');
            const result = await checkRateLimit('user-1');

            expect(result.allowed).toBe(false);
            expect(result.used).toBe(10);
            expect(result.remaining).toBe(0);
        });

        it('DB が利用不可の場合はフォールバックで許可する', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(null);

            const { checkRateLimit } = await import('@/lib/ai-assistant/rate-limiter');
            const result = await checkRateLimit('user-1');

            expect(result.allowed).toBe(true);
            expect(result.used).toBe(0);
            expect(result.remaining).toBe(10);
        });

        it('JST 日付境界を正しく処理する（UTC 15:00 = JST 翌日 0:00）', async () => {
            // 2024-01-15 14:59 UTC = 2024-01-15 23:59 JST → まだ1/15
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-15T14:59:00Z'));

            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(mockContainer);
            mockContainer.items.query.mockReturnValue({
                fetchAll: vi.fn().mockResolvedValue({ resources: [0] }),
            });

            const { checkRateLimit } = await import('@/lib/ai-assistant/rate-limiter');
            await checkRateLimit('user-1');

            const queryCall = mockContainer.items.query.mock.calls[0][0];
            // JST 1/15 0:00 = UTC 1/14 15:00
            expect(queryCall.parameters[1].value).toBe('2024-01-14T15:00:00.000Z');
        });

        it('JST 日付境界を正しく処理する（UTC 15:01 = JST 翌日 0:01）', async () => {
            // 2024-01-15 15:01 UTC = 2024-01-16 00:01 JST → 1/16
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-15T15:01:00Z'));

            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(mockContainer);
            mockContainer.items.query.mockReturnValue({
                fetchAll: vi.fn().mockResolvedValue({ resources: [0] }),
            });

            const { checkRateLimit } = await import('@/lib/ai-assistant/rate-limiter');
            await checkRateLimit('user-1');

            const queryCall = mockContainer.items.query.mock.calls[0][0];
            // JST 1/16 0:00 = UTC 1/15 15:00
            expect(queryCall.parameters[1].value).toBe('2024-01-15T15:00:00.000Z');
        });
    });

    describe('recordUsage', () => {
        it('使用記録を正常に作成する', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(mockContainer);

            const { recordUsage } = await import('@/lib/ai-assistant/rate-limiter');
            await recordUsage('user-1', 'qa-explain', 'q-1', 'exam-1');

            expect(mockContainer.items.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-1',
                    category: 'qa-explain',
                    questionId: 'q-1',
                    examId: 'exam-1',
                }),
            );
        });

        it('オプションパラメータなしでも動作する', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(mockContainer);

            const { recordUsage } = await import('@/lib/ai-assistant/rate-limiter');
            await recordUsage('user-1', 'site-guide');

            expect(mockContainer.items.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-1',
                    category: 'site-guide',
                    questionId: null,
                    examId: null,
                }),
            );
        });

        it('DB が利用不可の場合はスキップする', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValue(null);

            const { recordUsage } = await import('@/lib/ai-assistant/rate-limiter');
            await recordUsage('user-1', 'qa-explain');

            // エラーなく完了する
        });
    });

    describe('getJSTResetTime', () => {
        it('JST 翌日 0:00 の UTC 時刻を返す', async () => {
            vi.useFakeTimers();
            // 2024-01-15 10:00 UTC = 2024-01-15 19:00 JST
            vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

            const { getJSTResetTime } = await import('@/lib/ai-assistant/rate-limiter');
            const result = getJSTResetTime();

            // JST 1/16 0:00 = UTC 1/15 15:00
            expect(result).toBe('2024-01-15T15:00:00.000Z');
        });

        it('JST で日付が変わった直後の場合は当日 JST 翌日を返す', async () => {
            vi.useFakeTimers();
            // 2024-01-15 15:30 UTC = 2024-01-16 00:30 JST
            vi.setSystemTime(new Date('2024-01-15T15:30:00Z'));

            const { getJSTResetTime } = await import('@/lib/ai-assistant/rate-limiter');
            const result = getJSTResetTime();

            // JST 1/17 0:00 = UTC 1/16 15:00
            expect(result).toBe('2024-01-16T15:00:00.000Z');
        });
    });
});
