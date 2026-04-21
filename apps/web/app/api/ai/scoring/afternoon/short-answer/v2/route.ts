/**
 * 系統A: 記述式 採点API v2
 *  POST /api/ai/scoring/afternoon/short-answer/v2
 *
 * 設計書: docs/02_design/15_AfternoonScoringAPI_v2.md §2.1
 *
 * - mode=stream → SSE (text/event-stream) でストリーミング
 * - mode=batch  → 全観点完了後に1回のJSONレスポンス
 *
 * 認証: session.user.id 必須（共通設計 §12.1 準拠）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { z } from 'zod';
import { getQuestionMetaProvider } from '@/lib/scoring/questionMeta';
import { orchestrateShortAnswer } from '@/lib/scoring/orchestrator';
import { callPerspectiveLlmDefault } from '@/lib/scoring/llmClient';
import { eventStreamToReadable, SSE_HEADERS, collectEvents } from '@/lib/scoring/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const RequestSchema = z.object({
  questionId: z.string().min(1),
  userAnswer: z.string().min(1, 'userAnswer is required').max(2000),
  mode: z.enum(['stream', 'batch']).default('stream'),
});

export async function POST(req: NextRequest): Promise<Response> {
  // 1. 認証
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 2. リクエストパース
  let body: z.infer<typeof RequestSchema>;
  try {
    const json = await req.json();
    body = RequestSchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'EMPTY_ANSWER',
        details: err instanceof z.ZodError ? err.errors : String(err),
      },
      { status: 422 },
    );
  }

  // 3. 設問メタ取得
  const meta = await getQuestionMetaProvider().getShortAnswer(body.questionId);
  if (!meta) {
    return NextResponse.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }

  const events = orchestrateShortAnswer({
    meta,
    userAnswer: body.userAnswer,
    callLlm: callPerspectiveLlmDefault,
  });

  // 4. mode 別レスポンス
  if (body.mode === 'batch') {
    try {
      const collected = await collectEvents(events);
      const completeEvt = collected.find((e) => e.event === 'complete');
      const errors = collected.filter((e) => e.event === 'perspective_error');
      if (!completeEvt) {
        return NextResponse.json({ error: 'LLM_TIMEOUT', errors }, { status: 504 });
      }
      return NextResponse.json({ ...((completeEvt.data as object) ?? {}), partialErrors: errors });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: 'LLM_TIMEOUT', message }, { status: 504 });
    }
  }

  // stream
  return new Response(eventStreamToReadable(events), { status: 200, headers: SSE_HEADERS });
}
