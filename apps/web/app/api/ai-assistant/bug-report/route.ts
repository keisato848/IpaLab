import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { getContainer } from '@/lib/cosmos';
import { createBugReportIssue, isGitHubIssuesConfigured } from '@/lib/ai-assistant/github-issues';
import { uploadScreenshot } from '@/lib/ai-assistant/blob-upload';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    // 認証チェック
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        // レート制限チェック: 本日のバグ報告件数
        const container = await getContainer('BugReports');
        if (container) {
            const startOfDayUTC = getJSTStartOfDayUTC();
            const { resources } = await container.items.query({
                query: 'SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId AND c.createdAt >= @startOfDay',
                parameters: [
                    { name: '@userId', value: userId },
                    { name: '@startOfDay', value: startOfDayUTC },
                ],
            }).fetchAll();

            const count = resources[0] || 0;
            if (count >= 5) {
                return NextResponse.json(
                    { error: '本日の障害報告回数上限（5件）に達しました' },
                    { status: 429 }
                );
            }
        }

        // FormData のパース
        const formData = await req.formData();
        const description = formData.get('description') as string;
        const pageUrl = formData.get('pageUrl') as string;
        const userAgent = formData.get('userAgent') as string;
        const errorLogs = formData.get('errorLogs') as string | null;
        const screenshot = formData.get('screenshot') as File | null;

        // バリデーション
        if (!description || description.length < 1 || description.length > 2000) {
            return NextResponse.json(
                { error: '報告内容は1〜2000文字で入力してください' },
                { status: 400 }
            );
        }
        if (!pageUrl) {
            return NextResponse.json({ error: 'ページURLが必要です' }, { status: 400 });
        }

        // スクリーンショットアップロード（あれば）
        let screenshotUrl: string | undefined;
        if (screenshot) {
            try {
                const arrayBuffer = await screenshot.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                screenshotUrl = await uploadScreenshot(buffer, userId);
            } catch (e) {
                console.error('Screenshot upload failed:', e);
                // スクリーンショットのアップロード失敗はフォーム送信をブロックしない
            }
        }

        // GitHub Issue 作成（未設定時は graceful degradation）
        let issueResult: { number: number; html_url: string } | null = null;
        if (isGitHubIssuesConfigured()) {
            try {
                issueResult = await createBugReportIssue({
                    description,
                    pageUrl,
                    userAgent: userAgent || 'Unknown',
                    errorLogs: errorLogs || undefined,
                    screenshotUrl,
                });
            } catch (e) {
                console.error('GitHub Issue creation failed:', e);
                // Issue 作成失敗でも CosmosDB 記録は継続し、障害報告は受付完了として扱う
            }
        } else {
            console.warn('[bug-report] GITHUB_ISSUES_TOKEN/REPO not configured. Storing to CosmosDB only.');
        }

        // CosmosDB に記録
        if (container) {
            await container.items.create({
                id: crypto.randomUUID(),
                userId,
                description,
                screenshotUrl,
                pageUrl,
                userAgent: userAgent || 'Unknown',
                errorLogs: errorLogs || undefined,
                githubIssueNumber: issueResult?.number,
                githubIssueUrl: issueResult?.html_url,
                createdAt: new Date().toISOString(),
            });
        }

        return NextResponse.json({
            success: true,
            issueNumber: issueResult?.number ?? null,
            issueUrl: issueResult?.html_url ?? null,
        });
    } catch (error: any) {
        console.error('Bug report API error:', error);
        return NextResponse.json(
            { error: '障害報告の送信に失敗しました。しばらく経ってからお試しください。' },
            { status: 500 }
        );
    }
}

function getJSTStartOfDayUTC(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const year = jst.getUTCFullYear();
    const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jst.getUTCDate()).padStart(2, '0');
    const jstMidnight = new Date(`${year}-${month}-${day}T00:00:00+09:00`);
    return jstMidnight.toISOString();
}
