import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getContainer } from '@/lib/cosmos';

/**
 * GET /api/admin/analytics
 * ユーザー利用状況の分析データを取得
 *
 * クエリパラメータ:
 * - period: '7d' | '30d' | '90d' (デフォルト: '30d')
 */
export async function GET(request: Request) {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    try {
        const [
            userStats,
            sessionStats,
            recordStats,
            dailyActivity,
            examBreakdown,
            recentUsers,
            visitorStats,
        ] = await Promise.all([
            getUserStats(),
            getSessionStats(sinceISO),
            getRecordStats(sinceISO),
            getDailyActivity(sinceISO),
            getExamBreakdown(sinceISO),
            getRecentUsers(10),
            getVisitorStats(sinceISO),
        ]);

        return NextResponse.json({
            period,
            generatedAt: new Date().toISOString(),
            overview: {
                ...userStats,
                ...sessionStats,
                ...recordStats,
            },
            dailyActivity,
            examBreakdown,
            recentUsers,
            visitorStats,
        });
    } catch (err) {
        console.error('[Admin Analytics] エラー:', err);
        return NextResponse.json(
            { error: '分析データの取得に失敗しました' },
            { status: 500 }
        );
    }
}

/** ユーザー統計 */
async function getUserStats() {
    const container = await getContainer('Users');
    if (!container) return { totalUsers: 0, adminUsers: 0, guestUsers: 0 };

    try {
        const [totalResult, adminResult, guestResult] = await Promise.all([
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c',
            }).fetchAll(),
            container.items.query<number>({
                query: "SELECT VALUE COUNT(1) FROM c WHERE c.role = 'admin'",
            }).fetchAll(),
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.isGuest = true',
            }).fetchAll(),
        ]);

        return {
            totalUsers: totalResult.resources[0] ?? 0,
            adminUsers: adminResult.resources[0] ?? 0,
            guestUsers: guestResult.resources[0] ?? 0,
        };
    } catch {
        return { totalUsers: 0, adminUsers: 0, guestUsers: 0 };
    }
}

/** セッション統計 */
async function getSessionStats(sinceISO: string) {
    const container = await getContainer('LearningSessions');
    if (!container) return { totalSessions: 0, completedSessions: 0, activeSessions: 0, avgQuestionsPerSession: 0 };

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

        return {
            totalSessions: totalResult.resources[0] ?? 0,
            completedSessions: completedResult.resources[0] ?? 0,
            activeSessions: activeResult.resources[0] ?? 0,
            avgQuestionsPerSession: Math.round((avgResult.resources[0] ?? 0) * 10) / 10,
        };
    } catch {
        return { totalSessions: 0, completedSessions: 0, activeSessions: 0, avgQuestionsPerSession: 0 };
    }
}

/** 学習記録統計 */
async function getRecordStats(sinceISO: string) {
    const container = await getContainer('LearningRecords');
    if (!container) return { totalAnswers: 0, correctAnswers: 0, correctRate: 0, avgTimeSec: 0 };

    try {
        const [totalResult, correctResult, avgTimeResult] = await Promise.all([
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.answeredAt >= @since',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.answeredAt >= @since AND c.isCorrect = true',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
            container.items.query<number>({
                query: 'SELECT VALUE AVG(c.timeTakenSeconds) FROM c WHERE c.answeredAt >= @since AND c.timeTakenSeconds > 0',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
        ]);

        const total: number = totalResult.resources[0] ?? 0;
        const correct: number = correctResult.resources[0] ?? 0;
        const correctRate = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

        return {
            totalAnswers: total,
            correctAnswers: correct,
            correctRate,
            avgTimeSec: Math.round((avgTimeResult.resources[0] ?? 0) * 10) / 10,
        };
    } catch {
        return { totalAnswers: 0, correctAnswers: 0, correctRate: 0, avgTimeSec: 0 };
    }
}

/** 日別アクティビティ */
async function getDailyActivity(sinceISO: string) {
    const container = await getContainer('LearningRecords');
    if (!container) return [];

    try {
        const { resources } = await container.items.query<{
            date: string;
            count: number;
            correctCount: number;
        }>({
            query: `
                SELECT 
                    SUBSTRING(c.answeredAt, 0, 10) AS date,
                    COUNT(1) AS count,
                    SUM(c.isCorrect ? 1 : 0) AS correctCount
                FROM c
                WHERE c.answeredAt >= @since
                GROUP BY SUBSTRING(c.answeredAt, 0, 10)
                ORDER BY SUBSTRING(c.answeredAt, 0, 10) ASC
            `,
            parameters: [{ name: '@since', value: sinceISO }],
        }).fetchAll();

        return resources;
    } catch {
        return [];
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

/** 最近のユーザー */
async function getRecentUsers(limit: number) {
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
                    ORDER BY c.createdAt DESC 
                    OFFSET 0 LIMIT @limit`,
            parameters: [{ name: '@limit', value: limit }],
        }).fetchAll();

        return resources;
    } catch {
        return [];
    }
}

/** 訪問者統計（匿名ユーザー含む） */
async function getVisitorStats(sinceISO: string) {
    const container = await getContainer('PageViews');
    if (!container) {
        return {
            totalPageViews: 0,
            uniqueVisitors: 0,
            authenticatedVisitors: 0,
            anonymousVisitors: 0,
            dailyVisitors: [] as { date: string; total: number; authenticated: number; anonymous: number }[],
            topPages: [] as { path: string; views: number }[],
        };
    }

    try {
        const [
            totalViewsResult,
            uniqueVisitorsResult,
            authVisitorsResult,
            anonVisitorsResult,
            dailyVisitorsResult,
            topPagesResult,
        ] = await Promise.all([
            // 総ページビュー数
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.timestamp >= @since',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),

            // ユニーク訪問者数（visitorId ベース）
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM (SELECT DISTINCT c.visitorId FROM c WHERE c.timestamp >= @since)',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),

            // 認証済み訪問者数
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM (SELECT DISTINCT c.visitorId FROM c WHERE c.timestamp >= @since AND c.isAuthenticated = true)',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),

            // 匿名訪問者数
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM (SELECT DISTINCT c.visitorId FROM c WHERE c.timestamp >= @since AND c.isAuthenticated = false)',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),

            // 日別訪問者数
            container.items.query<{
                date: string;
                total: number;
                authenticated: number;
                anonymous: number;
            }>({
                query: `
                    SELECT
                        c.date,
                        COUNT(1) AS total,
                        SUM(c.isAuthenticated ? 1 : 0) AS authenticated,
                        SUM(c.isAuthenticated ? 0 : 1) AS anonymous
                    FROM c
                    WHERE c.timestamp >= @since
                    GROUP BY c.date
                    ORDER BY c.date ASC
                `,
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),

            // 人気ページ TOP 10
            container.items.query<{ path: string; views: number }>({
                query: `
                    SELECT
                        c.path,
                        COUNT(1) AS views
                    FROM c
                    WHERE c.timestamp >= @since
                    GROUP BY c.path
                    ORDER BY COUNT(1) DESC
                    OFFSET 0 LIMIT 10
                `,
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
        ]);

        return {
            totalPageViews: totalViewsResult.resources[0] ?? 0,
            uniqueVisitors: uniqueVisitorsResult.resources[0] ?? 0,
            authenticatedVisitors: authVisitorsResult.resources[0] ?? 0,
            anonymousVisitors: anonVisitorsResult.resources[0] ?? 0,
            dailyVisitors: dailyVisitorsResult.resources,
            topPages: topPagesResult.resources,
        };
    } catch (err) {
        console.error('[Admin Analytics] 訪問者統計エラー:', err);
        return {
            totalPageViews: 0,
            uniqueVisitors: 0,
            authenticatedVisitors: 0,
            anonymousVisitors: 0,
            dailyVisitors: [],
            topPages: [],
        };
    }
}
