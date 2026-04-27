/**
 * GET /api/user-progress/daily?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * リアルタイム日次進捗 API（#187）。
 *
 * - 認証ユーザーの LearningRecord を期間でフィルタし、`aggregateDailyProgress` で集計
 * - 既存 `DailyProgress` キャッシュは使用せず、常に最新を返す（リアルタイム）
 * - バッチで永続化する `POST /recompute` と並走する設計（仕様書 §3）
 *
 * Response: { items: DailyProgress[], summary: DailyProgressSummary }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { z } from 'zod';
import { learningRecordRepository } from '@/lib/repositories/learningRecordRepository';
import {
  aggregateDailyProgress,
  summarizeDailyProgress,
} from '@/lib/progress/aggregateDailyProgress';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedCounts: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    plannedCounts: searchParams.get('plannedCounts') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_QUERY', detail: parsed.error.issues },
      { status: 400 },
    );
  }
  const { from, to } = parsed.data;
  if (from > to) {
    return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 400 });
  }

  let plannedCounts: Record<string, number> | undefined;
  if (parsed.data.plannedCounts) {
    try {
      const obj = JSON.parse(parsed.data.plannedCounts) as unknown;
      if (obj && typeof obj === 'object') {
        plannedCounts = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
            plannedCounts[k] = Math.floor(v);
          }
        }
      }
    } catch {
      return NextResponse.json({ error: 'INVALID_PLANNED_COUNTS' }, { status: 400 });
    }
  }

  try {
    const records = await learningRecordRepository.findByUserId(userId);
    const items = aggregateDailyProgress({
      userId,
      records,
      from,
      to,
      plannedCounts,
      countSessions: true,
    });
    const summary = summarizeDailyProgress(items);
    return NextResponse.json({ items, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal Error';
    console.error('[user-progress/daily] Error:', message);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
