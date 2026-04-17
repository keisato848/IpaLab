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

vi.mock('@/lib/ai-assistant/github-issues', () => ({
    createBugReportIssue: vi.fn(),
    isGitHubIssuesConfigured: vi.fn(() => true),
}));

vi.mock('@/lib/ai-assistant/blob-upload', () => ({
    uploadScreenshot: vi.fn(),
}));

describe('/api/ai-assistant/bug-report', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('未認証の場合は 401 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue(null);

        const { POST } = await import('@/app/api/ai-assistant/bug-report/route');
        const formData = new FormData();
        formData.append('description', 'テスト');
        formData.append('pageUrl', 'http://localhost');

        const req = new NextRequest('http://localhost/api/ai-assistant/bug-report', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(req);
        expect(response.status).toBe(401);
    });

    it('レート制限超過の場合は 429 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const { getContainer } = await import('@/lib/cosmos');
        (getContainer as any).mockResolvedValue({
            items: {
                query: () => ({
                    fetchAll: async () => ({ resources: [5] }),
                }),
                create: vi.fn(),
            },
        });

        const { POST } = await import('@/app/api/ai-assistant/bug-report/route');
        const formData = new FormData();
        formData.append('description', 'テスト');
        formData.append('pageUrl', 'http://localhost');

        const req = new NextRequest('http://localhost/api/ai-assistant/bug-report', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(req);
        expect(response.status).toBe(429);
    });

    it('説明が空の場合は 400 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const { getContainer } = await import('@/lib/cosmos');
        (getContainer as any).mockResolvedValue({
            items: {
                query: () => ({
                    fetchAll: async () => ({ resources: [0] }),
                }),
                create: vi.fn(),
            },
        });

        const { POST } = await import('@/app/api/ai-assistant/bug-report/route');
        const formData = new FormData();
        formData.append('description', '');
        formData.append('pageUrl', 'http://localhost');

        const req = new NextRequest('http://localhost/api/ai-assistant/bug-report', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(req);
        expect(response.status).toBe(400);
    });

    it('正常な報告で Issue を作成し 200 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const mockContainer = {
            items: {
                query: () => ({
                    fetchAll: async () => ({ resources: [0] }),
                }),
                create: vi.fn().mockResolvedValue({}),
            },
        };
        const { getContainer } = await import('@/lib/cosmos');
        (getContainer as any).mockResolvedValue(mockContainer);

        const { createBugReportIssue } = await import('@/lib/ai-assistant/github-issues');
        (createBugReportIssue as any).mockResolvedValue({
            number: 42,
            html_url: 'https://github.com/test/issues/42',
        });

        const { POST } = await import('@/app/api/ai-assistant/bug-report/route');
        const formData = new FormData();
        formData.append('description', 'ボタンが動かない');
        formData.append('pageUrl', 'http://localhost/exam');
        formData.append('userAgent', 'Mozilla/5.0');

        const req = new NextRequest('http://localhost/api/ai-assistant/bug-report', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.issueNumber).toBe(42);
        expect(data.success).toBe(true);
        expect(mockContainer.items.create).toHaveBeenCalled();
    });

    it('GITHUB_ISSUES 未設定時は Issue 作成をスキップして 200 を返す (graceful degradation)', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const mockContainer = {
            items: {
                query: () => ({
                    fetchAll: async () => ({ resources: [0] }),
                }),
                create: vi.fn().mockResolvedValue({}),
            },
        };
        const { getContainer } = await import('@/lib/cosmos');
        (getContainer as any).mockResolvedValue(mockContainer);

        const { isGitHubIssuesConfigured, createBugReportIssue } = await import('@/lib/ai-assistant/github-issues');
        (isGitHubIssuesConfigured as any).mockReturnValueOnce(false);

        const { POST } = await import('@/app/api/ai-assistant/bug-report/route');
        const formData = new FormData();
        formData.append('description', '未設定でもCosmosに保存されること');
        formData.append('pageUrl', 'http://localhost/exam');

        const req = new NextRequest('http://localhost/api/ai-assistant/bug-report', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.issueNumber).toBeNull();
        expect(data.issueUrl).toBeNull();
        expect(createBugReportIssue).not.toHaveBeenCalled();
        expect(mockContainer.items.create).toHaveBeenCalled();
    });

    it('GitHub Issue 作成失敗時でも CosmosDB 記録して 200 を返す', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as any).mockResolvedValue({ user: { id: 'user-1' } });

        const mockContainer = {
            items: {
                query: () => ({
                    fetchAll: async () => ({ resources: [0] }),
                }),
                create: vi.fn().mockResolvedValue({}),
            },
        };
        const { getContainer } = await import('@/lib/cosmos');
        (getContainer as any).mockResolvedValue(mockContainer);

        const { createBugReportIssue } = await import('@/lib/ai-assistant/github-issues');
        (createBugReportIssue as any).mockRejectedValueOnce(new Error('GitHub API down'));

        const { POST } = await import('@/app/api/ai-assistant/bug-report/route');
        const formData = new FormData();
        formData.append('description', 'GitHubが落ちていてもCosmosに保存');
        formData.append('pageUrl', 'http://localhost/exam');

        const req = new NextRequest('http://localhost/api/ai-assistant/bug-report', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.issueNumber).toBeNull();
        expect(mockContainer.items.create).toHaveBeenCalled();
    });
});
