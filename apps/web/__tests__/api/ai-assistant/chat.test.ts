import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
    recordUsage: vi.fn(),
}));

vi.mock('@/lib/ai-assistant/context-builder', () => ({
    buildPrompt: vi.fn().mockReturnValue({
        systemPrompt: 'system',
        userMessage: 'user',
    }),
}));

vi.mock('@/lib/ai-assistant/gemini-chat', () => ({
    streamChatResponse: vi.fn(),
}));

describe('/api/ai-assistant/chat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('未認証の場合は 401 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue(null);

        const { POST } = await import('@/app/api/ai-assistant/chat/route');
        const req = new NextRequest('http://localhost/api/ai-assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ category: 'qa-explain', message: 'test' }),
        });

        const response = await POST(req);
        expect(response.status).toBe(401);
    });

    it('無効なカテゴリの場合は 400 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const { POST } = await import('@/app/api/ai-assistant/chat/route');
        const req = new NextRequest('http://localhost/api/ai-assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ category: 'invalid', message: 'test' }),
        });

        const response = await POST(req);
        expect(response.status).toBe(400);
    });

    it('空メッセージでもデフォルトトリガーで処理され 200 を返す（ユーザー入力廃止仕様）', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const { checkRateLimit, recordUsage } = await import('@/lib/ai-assistant/rate-limiter');
        (checkRateLimit as any).mockResolvedValue({ allowed: true, used: 1, remaining: 9 });
        (recordUsage as any).mockResolvedValue(undefined);

        const { streamChatResponse } = await import('@/lib/ai-assistant/gemini-chat');
        (streamChatResponse as any).mockImplementation(async function* () {
            yield 'OK';
        });

        const { POST } = await import('@/app/api/ai-assistant/chat/route');
        const req = new NextRequest('http://localhost/api/ai-assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ category: 'qa-explain', message: '' }),
        });

        const response = await POST(req);
        expect(response.status).toBe(200);
    });

    it('2000文字超過メッセージの場合は 400 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const { POST } = await import('@/app/api/ai-assistant/chat/route');
        const req = new NextRequest('http://localhost/api/ai-assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ category: 'qa-explain', message: 'x'.repeat(2001) }),
        });

        const response = await POST(req);
        expect(response.status).toBe(400);
    });

    it('レート制限超過の場合は 429 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const { checkRateLimit } = await import('@/lib/ai-assistant/rate-limiter');
        (checkRateLimit as any).mockResolvedValue({ allowed: false, used: 10, remaining: 0 });

        const { POST } = await import('@/app/api/ai-assistant/chat/route');
        const req = new NextRequest('http://localhost/api/ai-assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ category: 'qa-explain', message: 'テスト' }),
        });

        const response = await POST(req);
        expect(response.status).toBe(429);
    });

    it('正常リクエストで SSE ストリームを返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const { checkRateLimit, recordUsage } = await import('@/lib/ai-assistant/rate-limiter');
        (checkRateLimit as any).mockResolvedValue({ allowed: true, used: 3, remaining: 7 });
        (recordUsage as any).mockResolvedValue(undefined);

        const { streamChatResponse } = await import('@/lib/ai-assistant/gemini-chat');
        (streamChatResponse as any).mockImplementation(async function* () {
            yield 'Hello';
            yield ' World';
        });

        const { POST } = await import('@/app/api/ai-assistant/chat/route');
        const req = new NextRequest('http://localhost/api/ai-assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ category: 'qa-explain', message: 'テスト質問' }),
        });

        const response = await POST(req);
        expect(response.headers.get('Content-Type')).toBe('text/event-stream');

        const text = await response.text();
        expect(text).toContain('"token":"Hello"');
        expect(text).toContain('"token":" World"');
        expect(text).toContain('"done":true');
    });
});
