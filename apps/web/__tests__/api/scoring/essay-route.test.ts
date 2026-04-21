import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/scoring/llmClient', () => ({
  callPerspectiveLlmDefault: vi.fn(async () => ({
    score: 75,
    rationale: 'mock',
    evidence_quotes: [],
  })),
}));

const QID = 'PM-2024A-PM2-q1';
const validAnswer = {
  setsumonA: 'あ'.repeat(700),
  setsumonI: 'い'.repeat(1200),
  setsumonU: 'う'.repeat(900),
};

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/ai/scoring/afternoon/essay/v2', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const auth = async (uid: string | null) => {
  const { getServerSession } = await import('next-auth');
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(uid ? { user: { id: uid } } : null);
};

describe('POST /api/ai/scoring/afternoon/essay/v2', () => {
  beforeEach(() => vi.clearAllMocks());

  it('未認証は 401', async () => {
    await auth(null);
    const { POST } = await import('@/app/api/ai/scoring/afternoon/essay/v2/route');
    const res = await POST(
      makeReq({ questionId: QID, answer: validAnswer }),
    );
    expect(res.status).toBe(401);
  });

  it('全フィールド空は 422 EMPTY_ANSWER', async () => {
    await auth('u1');
    const { POST } = await import('@/app/api/ai/scoring/afternoon/essay/v2/route');
    const res = await POST(
      makeReq({ questionId: QID, answer: { setsumonA: '', setsumonI: '', setsumonU: '' } }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('EMPTY_ANSWER');
  });

  it('未知の questionId は 404', async () => {
    await auth('u1');
    const { POST } = await import('@/app/api/ai/scoring/afternoon/essay/v2/route');
    const res = await POST(
      makeReq({ questionId: 'unknown', answer: validAnswer }),
    );
    expect(res.status).toBe(404);
  });

  it('小問が charMax の 1.5 倍超は 422 SECTION_SPLIT_FAILED', async () => {
    await auth('u1');
    const { POST } = await import('@/app/api/ai/scoring/afternoon/essay/v2/route');
    const res = await POST(
      makeReq({
        questionId: QID,
        answer: { ...validAnswer, setsumonA: 'あ'.repeat(2000) }, // 800*1.5=1200 超
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('SECTION_SPLIT_FAILED');
  });

  it('小問が charMin の半分未満は 422 CHAR_COUNT_VIOLATION_FATAL', async () => {
    await auth('u1');
    const { POST } = await import('@/app/api/ai/scoring/afternoon/essay/v2/route');
    const res = await POST(
      makeReq({
        questionId: QID,
        answer: { ...validAnswer, setsumonI: 'い'.repeat(100) }, // 800/2=400 未満
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('CHAR_COUNT_VIOLATION_FATAL');
  });

  it('mode=batch は overallRank/subQuestionScores を含む JSON を返す', async () => {
    await auth('u1');
    const { POST } = await import('@/app/api/ai/scoring/afternoon/essay/v2/route');
    const res = await POST(
      makeReq({ questionId: QID, answer: validAnswer, mode: 'batch' }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.format).toBe('essay');
    expect(json.questionId).toBe(QID);
    expect(['A', 'B', 'C', 'D']).toContain(json.overallRank);
    expect((json.subQuestionScores as unknown[]).length).toBe(3);
  });

  it('mode=stream は SSE で sub_question_start / perspective / complete を含む', async () => {
    await auth('u1');
    const { POST } = await import('@/app/api/ai/scoring/afternoon/essay/v2/route');
    const res = await POST(
      makeReq({ questionId: QID, answer: validAnswer, mode: 'stream' }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/);
    const text = await res.text();
    expect(text).toContain('event: sub_question_start');
    expect(text).toContain('event: perspective');
    expect(text).toContain('event: sub_question_complete');
    expect(text).toContain('event: complete');
  });
});
