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

        const [records, persistedDailyProgresses, plans] = await Promise.all([
            learningRecordRepository.findByUserId(userId),
            dailyProgressRepository.findByUserAndDateRange(userId, from, today),
            studyPlanRepository.listByUser(userId).catch(() => []),
        ]);

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
        const message = e instanceof Error ? e.message : 'Internal Error';
        return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 });
    }
}
