import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getContainer } from '@/lib/cosmos';

const DEFAULT_ANALYTICS_DAYS = 30;
const MIN_ANALYTICS_DAYS = 1;
const MAX_ANALYTICS_DAYS = 365;

function parseAnalyticsPeriod(rawPeriod: string | null) {
    if (!rawPeriod) {
        return {
            days: DEFAULT_ANALYTICS_DAYS,
            period: `${DEFAULT_ANALYTICS_DAYS}d`,
        };
    }

    const normalized = rawPeriod.trim().toLowerCase();
    const match = normalized.match(/^(\d+)(d)?$/);

    if (!match) {
        return null;
    }

    const days = Number.parseInt(match[1], 10);
    if (!Number.isFinite(days) || days < MIN_ANALYTICS_DAYS || days > MAX_ANALYTICS_DAYS) {
        return null;
    }

    return {
        days,
        period: `${days}d`,
    };
}

/**
 * GET /api/admin/analytics
 * サービス固有の利用状況分析データを取得（訪問者数はGA4で計測）
 *
 * クエリパラメータ:
 * - period: '7d' | '30d' | '90d' | '{任意の日数}d' | '{任意の日数}' (デフォルト: '30d')
 */
export async function GET(request: Request) {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const parsedPeriod = parseAnalyticsPeriod(searchParams.get('period'));
    if (!parsedPeriod) {
        return NextResponse.json(
            { error: `period は ${MIN_ANALYTICS_DAYS}〜${MAX_ANALYTICS_DAYS} 日の範囲で指定してください` },
            { status: 400 }
        );
    }

    const { days, period } = parsedPeriod;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    const recentUsersSince = new Date();
    recentUsersSince.setHours(recentUsersSince.getHours() - 24);
    const recentUsersSinceISO = recentUsersSince.toISOString();

    try {
        const [
            userStats,
            sessionStats,
            answerStats,
            examBreakdown,
            recentUsers,
            activityStats,
        ] = await Promise.all([
            getUserStats(),
            getSessionStats(sinceISO),
            getAnswerStats(sinceISO),
            getExamBreakdown(sinceISO),
            getRecentUsers(recentUsersSinceISO),
            getDauMauStats(sinceISO),
        ]);

        return NextResponse.json({
            period,
            generatedAt: new Date().toISOString(),
            overview: {
                ...userStats,
                ...sessionStats,
                ...answerStats,
            },
            examBreakdown,
            recentUsers,
            activityStats,
        });
    } catch (err) {
        console.error('[Admin Analytics] エラー:', err);
        return NextResponse.json(
            { error: '分析データの取得に失敗しました' },
            { status: 500 }
        );
    }
}

/** ユーザー統計：登録ユーザー数・ゲスト数・転換率 */
async function getUserStats() {
    const container = await getContainer('Users');
    if (!container) return { guestUsers: 0, registeredUsers: 0, conversionRate: 0 };

    try {
        const [guestResult, registeredResult] = await Promise.all([
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.isGuest = true',
            }).fetchAll(),
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.isGuest = false',
            }).fetchAll(),
        ]);

        const guestUsers = guestResult.resources[0] ?? 0;
        const registeredUsers = registeredResult.resources[0] ?? 0;
        const total = guestUsers + registeredUsers;
        const conversionRate = total > 0 ? Math.round((registeredUsers / total) * 1000) / 10 : 0;

        return { guestUsers, registeredUsers, conversionRate };
    } catch {
        return { guestUsers: 0, registeredUsers: 0, conversionRate: 0 };
    }
}

/** セッション統計 */
async function getSessionStats(sinceISO: string) {
    const container = await getContainer('LearningSessions');
    if (!container) return { totalSessions: 0, completedSessions: 0, completionRate: 0, activeSessions: 0, avgQuestionsPerSession: 0 };

    try {
        const [totalResult, completedResult, activeResult, avgResult] = await Promise.all([
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.startedAt >= @since',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
            container.items.query<number>({
                query: "SELECT VALUE COUNT(1) FROM c WHERE c.startedAt >= @since AND c.status = 'completed'",
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
            container.items.query<number>({
                query: "SELECT VALUE COUNT(1) FROM c WHERE c.status = 'in-progress'",
            }).fetchAll(),
            container.items.query<number>({
                query: 'SELECT VALUE AVG(c.answeredCount) FROM c WHERE c.startedAt >= @since AND c.answeredCount > 0',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
        ]);

        const totalSessions = totalResult.resources[0] ?? 0;
        const completedSessions = completedResult.resources[0] ?? 0;
        const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 1000) / 10 : 0;

        return {
            totalSessions,
            completedSessions,
            completionRate,
            activeSessions: activeResult.resources[0] ?? 0,
            avgQuestionsPerSession: Math.round((avgResult.resources[0] ?? 0) * 10) / 10,
        };
    } catch {
        return { totalSessions: 0, completedSessions: 0, completionRate: 0, activeSessions: 0, avgQuestionsPerSession: 0 };
    }
}

/** 回答統計：総回答数・正解数・正解率 */
async function getAnswerStats(sinceISO: string) {
    const container = await getContainer('LearningRecords');
    if (!container) return { totalAnswers: 0, correctAnswers: 0, accuracyRate: 0 };

    try {
        const [totalResult, correctResult] = await Promise.all([
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.answeredAt >= @since',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.answeredAt >= @since AND c.isCorrect = true',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
        ]);

        const totalAnswers = totalResult.resources[0] ?? 0;
        const correctAnswers = correctResult.resources[0] ?? 0;
        const accuracyRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 1000) / 10 : 0;

        return { totalAnswers, correctAnswers, accuracyRate };
    } catch {
        return { totalAnswers: 0, correctAnswers: 0, accuracyRate: 0 };
    }
}

/** 試験別分布 */
async function getExamBreakdown(sinceISO: string) {
    const container = await getContainer('LearningSessions');
    if (!container) return [];

    try {
        const { resources } = await container.items.query<{
            examId: string;
            count: number;
            completedCount: number;
        }>({
            query: `
                SELECT 
                    c.examId,
                    COUNT(1) AS count,
                    SUM(c.status = 'completed' ? 1 : 0) AS completedCount
                FROM c
                WHERE c.startedAt >= @since
                GROUP BY c.examId
            `,
            parameters: [{ name: '@since', value: sinceISO }],
        }).fetchAll();

        return resources;
    } catch {
        return [];
    }
}

/** 24時間以内に登録したユーザー */
async function getRecentUsers(sinceISO: string) {
    const container = await getContainer('Users');
    if (!container) return [];

    try {
        const { resources } = await container.items.query<{
            id: string;
            name: string | null;
            email: string | null;
            role: string;
            createdAt: string;
            isGuest: boolean;
        }>({
            query: `SELECT c.id, c.name, c.email, c.role, c.createdAt, c.isGuest 
                FROM c 
                WHERE c.createdAt >= @since
                ORDER BY c.createdAt DESC`,
            parameters: [{ name: '@since', value: sinceISO }],
        }).fetchAll();

        return resources;
    } catch {
        return [];
    }
}

/** DAU（日別アクティブユーザー数）・MAU（直近30日アクティブユーザー数）
 *  LearningRecords の answeredAt を基準に、userId distinct で集計する
 */
async function getDauMauStats(sinceISO: string) {
    const container = await getContainer('LearningRecords');
    if (!container) return { dau: [] as { date: string; uniqueUsers: number }[], mau: 0 };

    const mauSinceISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
        // (date, userId) のユニークペアを取得してDAUを集計
        const { resources: dauRaw } = await container.items.query<{ date: string; userId: string }>({
            query: `SELECT SUBSTRING(c.answeredAt, 0, 10) AS date, c.userId
                    FROM c
                    WHERE c.answeredAt >= @since AND IS_DEFINED(c.userId)
                    GROUP BY SUBSTRING(c.answeredAt, 0, 10), c.userId`,
            parameters: [{ name: '@since', value: sinceISO }],
        }).fetchAll();

        // JS側で日別ユニークユーザー数を集計
        const dauMap = new Map<string, Set<string>>();
        for (const row of dauRaw) {
            if (!row.userId) continue;
            if (!dauMap.has(row.date)) dauMap.set(row.date, new Set());
            dauMap.get(row.date)!.add(row.userId);
        }
        const dau = Array.from(dauMap.entries())
            .map(([date, users]) => ({ date, uniqueUsers: users.size }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // MAU: 直近30日間のユニークユーザー数
        const { resources: mauRaw } = await container.items.query<{ userId: string }>({
            query: `SELECT DISTINCT c.userId FROM c
                    WHERE c.answeredAt >= @since AND IS_DEFINED(c.userId)`,
            parameters: [{ name: '@since', value: mauSinceISO }],
        }).fetchAll();
        const mau = mauRaw.filter((r: { userId?: string }) => r.userId).length;

        return { dau, mau };
    } catch (err) {
        console.error('[Admin Analytics] DAU/MAU集計エラー:', err);
        return { dau: [] as { date: string; uniqueUsers: number }[], mau: 0 };
    }
}

