/**
 * GET /api/profile/performance
 *
 * 認証ユーザの PerformanceProfile を返す (#218 / v2.0 MVP3)。
 * - 過去28日の DailyProgress + LearningRecord + 最新 StudyPlan を集計
 * - 純粋関数 `buildPerformanceProfile` を経由 (AI 呼び出しなし)
 *
 * Response: { profile: PerformanceProfile }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { learningRecordRepository } from '@/lib/repositories/learningRecordRepository';
import { dailyProgressRepository } from '@/lib/repositories/dailyProgressRepository';
import { studyPlanRepository } from '@/lib/repositories/studyPlanRepository';
import { aggregateDailyProgress } from '@/lib/progress/aggregateDailyProgress';
import { buildPerformanceProfile } from '@/lib/profile/buildPerformanceProfile';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 28;

function todayKey(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function addDays(date: string, n: number): string {
    const d = new Date(`${date}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + n);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export async function GET(_request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const today = todayKey();
        const from = addDays(today, -(WINDOW_DAYS - 1));
        const fromIso = `${from}T00:00:00.000Z`;
        // 排他的上限。toIso は today の翌日 00:00 で today 当日分も含める
        const toIso = `${addDays(today, 1)}T00:00:00.000Z`;

        // 各リポジトリ呼び出しは個別に catch し、1 つの依存先障害で API 全体が
        // 500 にならないよう劣化フォールバックする。
        // 特に DailyProgress コンテナは #207 で新設のため、共用 Cosmos に
        // プロビジョン未済の環境では 404 を返し得る。
        const [records, persistedDailyProgresses, plansResult] = await Promise.all([
            learningRecordRepository
                .findByUserIdInDateRange(userId, fromIso, toIso)
                .catch((err: unknown) => {
                    console.error('[api/profile/performance] learningRecordRepository.findByUserIdInDateRange failed', err);
                    return [] as Awaited<ReturnType<typeof learningRecordRepository.findByUserIdInDateRange>>;
                }),
            dailyProgressRepository
                .findByUserAndDateRange(userId, from, today)
                .catch((err: unknown) => {
                    console.error('[api/profile/performance] dailyProgressRepository.findByUserAndDateRange failed', err);
                    return [] as Awaited<ReturnType<typeof dailyProgressRepository.findByUserAndDateRange>>;
                }),
            studyPlanRepository
                .listByUser(userId)
                .then((rows) => ({ ok: true as const, rows }))
                .catch((err: unknown) => {
                    console.error('[api/profile/performance] studyPlanRepository.listByUser failed', err);
                    return { ok: false as const, rows: [] };
                }),
        ]);
        const plans = plansResult.rows;

        // 永続化された DailyProgress に加え、リアルタイム集計でフォールバック
        // (バッチ未実行の最新分も拾うため、Records から再集計したものを優先する)
        const realtime = aggregateDailyProgress({
            userId,
            records,
            from,
            to: today,
            countSessions: true,
        });
        // realtime を優先しつつ、欠落日は永続版で補完
        const realtimeMap = new Map(realtime.map((p) => [p.date, p]));
        for (const p of persistedDailyProgresses) {
            if (!realtimeMap.has(p.date)) realtimeMap.set(p.date, p);
        }
        const dailyProgresses = Array.from(realtimeMap.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
        );

        // 最新の StudyPlan (generatedAt 降順)
        const plan = plans
            .slice()
            .sort((a, b) => (b.generatedAt ?? '').localeCompare(a.generatedAt ?? ''))[0];

        const profile = buildPerformanceProfile({
            userId,
            dailyProgresses,
            records,
            plan,
            today,
        });

        return NextResponse.json({ profile });
    } catch (e) {
        console.error('[api/profile/performance] unhandled error', e);
        const message = e instanceof Error ? e.message : 'Internal Error';
        return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
    }
}
