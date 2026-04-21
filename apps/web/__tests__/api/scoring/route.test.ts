import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/scoring/llmClient', () => ({
  callPerspectiveLlmDefault: vi.fn(async () => ({
    score: 80,
    rationale: 'mock',
    matched_keywords: [],
    missing_keywords: [],
  })),
}));

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/ai/scoring/afternoon/short-answer/v2', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('POST /api/ai/scoring/afternoon/short-answer/v2', () => {
  beforeEach(() => vi.clearAllMocks());

  it('未認証は 401', async () => {
    const { getServerSession } = await import('next-auth');
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { POST } = await import('@/app/api/ai/scoring/afternoon/short-answer/v2/route');
    const res = await POST(makeReq({ questionId: 'x', userAnswer: 'y' }));
    expect(res.status).toBe(401);
  });

  it('userAnswer 空は 422', async () => {
    const { getServerSession } = await import('next-auth');
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1' } });
    const { POST } = await import('@/app/api/ai/scoring/afternoon/short-answer/v2/route');
    const res = await POST(makeReq({ questionId: 'AP-2023S-PM-01-q1', userAnswer: '' }));
    expect(res.status).toBe(422);
  });

  it('未知の questionId は 404', async () => {
    const { getServerSession } = await import('next-auth');
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1' } });
    const { POST } = await import('@/app/api/ai/scoring/afternoon/short-answer/v2/route');
    const res = await POST(makeReq({ questionId: 'unknown-q', userAnswer: '回答' }));
    expect(res.status).toBe(404);
  });

  it('mode=batch は JSON で総合結果を返す', async () => {
    const { getServerSession } = await import('next-auth');
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1' } });
    const { POST } = await import('@/app/api/ai/scoring/afternoon/short-answer/v2/route');
    const res = await POST(
      makeReq({
        questionId: 'AP-2023S-PM-01-q1',
        userAnswer: '多要素認証を全社で導入する',
        mode: 'batch',
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.format).toBe('short_answer');
    expect(json.questionId).toBe('AP-2023S-PM-01-q1');
    expect(Array.isArray(json.perspectiveScores)).toBe(true);
    expect((json.perspectiveScores as unknown[]).length).toBe(4);
  });

  it('mode=stream は text/event-stream で返す', async () => {
    const { getServerSession } = await import('next-auth');
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1' } });
    const { POST } = await import('@/app/api/ai/scoring/afternoon/short-answer/v2/route');
    const res = await POST(
      makeReq({
        questionId: 'AP-2023S-PM-01-q1',
        userAnswer: '多要素認証を導入する',
        mode: 'stream',
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/);
    const text = await res.text();
    expect(text).toContain('event: perspective');
    expect(text).toContain('event: complete');
  });
});

describe('POST /api/ai/scoring/afternoon/essay/v2 (skeleton)', () => {
  beforeEach(() => vi.clearAllMocks());
  it('未認証は 401', async () => {
    const { getServerSession } = await import('next-auth');
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { POST } = await import('@/app/api/ai/scoring/afternoon/essay/v2/route');
    const res = await POST(
      new NextRequest('http://localhost/api/ai/scoring/afternoon/essay/v2', { method: 'POST' }),
    );
    expect(res.status).toBe(401);
  });
});
