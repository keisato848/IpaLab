/**
 * 系統B: 論述式 採点API v2 (#176 後続実装)
 *  POST /api/ai/scoring/afternoon/essay/v2
 *
 * 設計書: docs/02_design/15_AfternoonScoringAPI_v2.md §2.2
 *
 * 現状: スケルトンのみ。本実装は後続コミットで対応。
 *  - 18 LLM 並列呼び出し (3小問 × 6観点)
 *  - 章節分割 (ア/イ/ウ)
 *  - SSE: sub_question_start / perspective / sub_question_complete / complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json(
    {
      error: 'NOT_IMPLEMENTED',
      message: '系統B (論述式) 採点API v2 は後続実装予定です。',
    },
    { status: 501 },
  );
}
