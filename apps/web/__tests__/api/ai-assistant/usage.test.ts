import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn(),
}));

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));

vi.mock('@/auth', () => ({
    authOptions: {},
}));

vi.mock('@/lib/ai-assistant/rate-limiter', () => ({
    checkRateLimit: vi.fn(),
    getJSTResetTime: vi.fn(),
}));

describe('/api/ai-assistant/usage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('未認証の場合は 401 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue(null);

        const { GET } = await import('@/app/api/ai-assistant/usage/route');
        const response = await GET();
        expect(response.status).toBe(401);
    });

    it('正常に使用状況を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const { checkRateLimit, getJSTResetTime } = await import('@/lib/ai-assistant/rate-limiter');
        (checkRateLimit as any).mockResolvedValue({ used: 3, remaining: 7 });
        (getJSTResetTime as any).mockReturnValue('2024-01-15T15:00:00.000Z');

        const { GET } = await import('@/app/api/ai-assistant/usage/route');
        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            used: 3,
            limit: 10,
            remaining: 7,
            resetsAt: '2024-01-15T15:00:00.000Z',
        });
    });

    it('checkRateLimit がエラーの場合は 500 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const { checkRateLimit } = await import('@/lib/ai-assistant/rate-limiter');
        (checkRateLimit as any).mockRejectedValue(new Error('DB error'));

        const { GET } = await import('@/app/api/ai-assistant/usage/route');
        const response = await GET();
        expect(response.status).toBe(500);
    });
});
