import { NextResponse } from 'next/server';
import { DefaultAzureCredential } from '@azure/identity';
import { LogsQueryClient, LogsQueryResultStatus } from '@azure/monitor-query-logs';
import { requireAdmin } from '@/lib/admin-auth';
import { getContainer } from '@/lib/cosmos';

const DEFAULT_ANALYTICS_DAYS = 30;
const MIN_ANALYTICS_DAYS = 1;
const MAX_ANALYTICS_DAYS = 365;
const telemetryResourceId = process.env.TELEMETRY_RESOURCE_ID;
const logsQueryClient = telemetryResourceId ? new LogsQueryClient(new DefaultAzureCredential()) : null;

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
 * ユーザー利用状況の分析データを取得
 *
 * クエリパラメータ:
 * - period: '7d' | '30d' | '90d' | '{任意の日数}d' | '{任意の日数}' (デフォルト: '30d')
 */
export async function GET(request: Request) {
    const { error } = await requireAdmin();
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
            visitorOverview,
            sessionStats,
            recordStats,
            examBreakdown,
            recentUsers,
            visitorStats,
        ] = await Promise.all([
            getUserStats(),
            getVisitorOverview(since, days),
            getSessionStats(sinceISO),
            getRecordStats(sinceISO),
            getExamBreakdown(sinceISO),
            getRecentUsers(recentUsersSinceISO),
            getVisitorStats(sinceISO),
        ]);

        return NextResponse.json({
            period,
            generatedAt: new Date().toISOString(),
            overview: {
                ...userStats,
                ...visitorOverview,
                ...sessionStats,
                ...recordStats,
            },
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
    if (!container) return { guestUsers: 0 };

    try {
        const [guestResult] = await Promise.all([
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.isGuest = true',
            }).fetchAll(),
        ]);

        return {
            guestUsers: guestResult.resources[0] ?? 0,
        };
    } catch {
        return { guestUsers: 0 };
    }
}

/** App Insights 由来の訪問者統計 */
async function getVisitorOverview(since: Date, days: number) {
    if (!telemetryResourceId || !logsQueryClient) {
        console.warn('[Admin Analytics] TELEMETRY_RESOURCE_ID が未設定のため App Insights 集計をスキップします');
        return { totalUsers: 0 };
    }

    try {
        // AppRequests テーブルを使用 (AppPageViews はクライアントサイド SDK が必要なため未送信)
        // API エンドポイントを除外し、ページリクエストのみ対象とする
        // UserAuthenticatedId/UserId は Node.js SDK では記録されないため OperationId で代替
        const result = await logsQueryClient.queryResource(
            telemetryResourceId,
            `AppRequests
            | where TimeGenerated >= ago(${days}d)
            | where not(Name startswith "GET /api/" or Name startswith "POST /api/" or Name startswith "HEAD ")
            | extend visitorKey = coalesce(UserAuthenticatedId, UserId, SessionId, OperationId)
            | where isnotempty(visitorKey)
            | summarize totalUsers = dcount(visitorKey)`,
            { startTime: since, endTime: new Date() },
            { serverTimeoutInSeconds: 30 }
        );

        if (result.status !== LogsQueryResultStatus.Success) {
            console.warn('[Admin Analytics] App Insights クエリが部分失敗しました:', result.partialError);
            return { totalUsers: 0 };
        }

        const table = result.tables[0];
        const totalUsers = Number(table?.rows?.[0]?.[0] ?? 0);
        return { totalUsers: Number.isFinite(totalUsers) ? totalUsers : 0 };
    } catch (err) {
        console.error('[Admin Analytics] App Insights 訪問者集計エラー:', err);
        return { totalUsers: 0 };
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
    if (!container) return { totalAnswers: 0 };

    try {
        const [totalResult] = await Promise.all([
            container.items.query<number>({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.answeredAt >= @since',
                parameters: [{ name: '@since', value: sinceISO }],
            }).fetchAll(),
        ]);

        return {
            totalAnswers: totalResult.resources[0] ?? 0,
        };
    } catch {
        return { totalAnswers: 0 };
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
        };
    }

    try {
        const [
            totalViewsResult,
            uniqueVisitorsResult,
            authVisitorsResult,
            anonVisitorsResult,
            dailyVisitorsResult,
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
        ]);

        return {
            totalPageViews: totalViewsResult.resources[0] ?? 0,
            uniqueVisitors: uniqueVisitorsResult.resources[0] ?? 0,
            authenticatedVisitors: authVisitorsResult.resources[0] ?? 0,
            anonymousVisitors: anonVisitorsResult.resources[0] ?? 0,
            dailyVisitors: dailyVisitorsResult.resources,
        };
    } catch (err) {
        console.error('[Admin Analytics] 訪問者統計エラー:', err);
        return {
            totalPageViews: 0,
            uniqueVisitors: 0,
            authenticatedVisitors: 0,
            anonymousVisitors: 0,
            dailyVisitors: [],
        };
    }
}
