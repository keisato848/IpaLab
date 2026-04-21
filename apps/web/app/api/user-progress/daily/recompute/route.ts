/**
 * POST /api/user-progress/daily/recompute
 *
 * バッチ再集計エンドポイント（#187）。
 *
 * - 認証ユーザー or 管理用シークレット (`x-recompute-secret`) で実行可能
 * - 期間 [from, to] を指定し、LearningRecord から日次進捗を集計し DailyProgress に upsert
 * - 冪等: 同 `${userId}-${date}` を上書きするので何度叩いても一貫
 * - Azure Functions Timer / GitHub Actions cron から呼び出すことを想定
 *
 * Response: { upsertedCount: number, range: { from, to } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { z } from 'zod';
import { learningRecordRepository } from '@/lib/repositories/learningRecordRepository';
import { dailyProgressRepository } from '@/lib/repositories/dailyProgressRepository';
import { aggregateDailyProgress } from '@/lib/progress/aggregateDailyProgress';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z.object({
  userId: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedCounts: z.record(z.string(), z.number()).optional(),
});

const RECOMPUTE_SECRET = process.env.RECOMPUTE_SECRET;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;
  const headerSecret = request.headers.get('x-recompute-secret');
  const isAdmin = !!RECOMPUTE_SECRET && headerSecret === RECOMPUTE_SECRET;

  if (!sessionUserId && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_QUERY', detail: parsed.error.issues },
      { status: 400 },
    );
  }
  const { from, to, plannedCounts } = parsed.data;
  if (from > to) {
    return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 400 });
  }
  // 一般ユーザーは自分の userId のみ。admin は body.userId を尊重。
  const userId = isAdmin ? parsed.data.userId ?? sessionUserId : sessionUserId;
  if (!userId) {
    return NextResponse.json({ error: 'USER_ID_REQUIRED' }, { status: 400 });
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
    const upsertedCount = await dailyProgressRepository.upsertMany(items);
    return NextResponse.json({ upsertedCount, range: { from, to } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal Error';
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
