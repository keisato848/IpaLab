/**
 * 系統B: 論述式 採点API v2
 *  POST /api/ai/scoring/afternoon/essay/v2
 *
 * 設計書: docs/02_design/15_AfternoonScoringAPI_v2.md §2.2
 *
 * - mode=stream → SSE (sub_question_start/perspective/sub_question_complete/complete)
 * - mode=batch  → 全観点完了後に1回のJSONレスポンス
 *
 * 認証: session.user.id 必須
 *
 * バリデーション:
 *  - answer.{setsumonA, setsumonI, setsumonU} は構造化済みを要求（自由文の章節分割は v2.1 以降）
 *  - 全フィールド合算で 1 字以上 → そうでなければ EMPTY_ANSWER (422)
 *  - 各小問が charMax×1.5 を超える長文は SECTION_SPLIT_FAILED (422)（誤って一括貼付の検出）
 *  - いずれかの小問が charMin×0.5 未満 → CHAR_COUNT_VIOLATION_FATAL (422) で即時返却
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { z } from 'zod';
import { getQuestionMetaProvider } from '@/lib/scoring/questionMeta';
import { orchestrateEssay } from '@/lib/scoring/essayOrchestrator';
import { callPerspectiveLlmDefault } from '@/lib/scoring/llmClient';
import { eventStreamToReadable, SSE_HEADERS, collectEvents } from '@/lib/scoring/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const RequestSchema = z.object({
  questionId: z.string().min(1),
  answer: z.object({
    setsumonA: z.string().max(3000).default(''),
    setsumonI: z.string().max(4000).default(''),
    setsumonU: z.string().max(3000).default(''),
  }),
  mode: z.enum(['stream', 'batch']).default('stream'),
});

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (err) {
    console.error('[essay-v2] Invalid request body:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'EMPTY_ANSWER', details: err instanceof z.ZodError ? err.errors : String(err) },
      { status: 422 },
    );
  }

  const totalLen =
    Array.from(body.answer.setsumonA).length +
    Array.from(body.answer.setsumonI).length +
    Array.from(body.answer.setsumonU).length;
  if (totalLen === 0) {
    return NextResponse.json({ error: 'EMPTY_ANSWER' }, { status: 422 });
  }

  const meta = await getQuestionMetaProvider().getEssay(body.questionId);
  if (!meta) {
    return NextResponse.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }

  // 章節分割失敗の検出: いずれかの小問が charMax の 1.5 倍を超える場合は誤った貼付の可能性
  for (const key of ['A', 'I', 'U'] as const) {
    const text =
      key === 'A' ? body.answer.setsumonA : key === 'I' ? body.answer.setsumonI : body.answer.setsumonU;
    const len = Array.from(text).length;
    const max = meta.subQuestions[key].charMax;
    if (max > 0 && len > Math.floor(max * 1.5)) {
      return NextResponse.json(
        { error: 'SECTION_SPLIT_FAILED', subQuestion: key, charCount: len, charMax: max },
        { status: 422 },
      );
    }
  }

  // 致命的な字数不足の検出
  for (const key of ['A', 'I', 'U'] as const) {
    const text =
      key === 'A' ? body.answer.setsumonA : key === 'I' ? body.answer.setsumonI : body.answer.setsumonU;
    const len = Array.from(text).length;
    const min = meta.subQuestions[key].charMin;
    if (min > 0 && len > 0 && len < Math.floor(min / 2)) {
      return NextResponse.json(
        { error: 'CHAR_COUNT_VIOLATION_FATAL', subQuestion: key, charCount: len, charMin: min },
        { status: 422 },
      );
    }
  }

  const events = orchestrateEssay({
    meta,
    answer: body.answer,
    callLlm: callPerspectiveLlmDefault,
  });

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
      console.error('[essay-v2] LLM batch error:', message);
      return NextResponse.json({ error: 'LLM_TIMEOUT', message }, { status: 504 });
    }
  }

  return new Response(eventStreamToReadable(events), { status: 200, headers: SSE_HEADERS });
}
