/**
 * AI Plan Jobs API
 * POST /api/ai/jobs - 非同期ジョブを作成
 * GET /api/ai/jobs - ユーザーの最新ジョブを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { getContainer } from '@/lib/cosmos';
import { StudyPlanJob } from '@/lib/api';
import { QueueClient, QueueServiceClient } from '@azure/storage-queue';

const QUEUE_NAME = process.env.AI_JOB_QUEUE_NAME || 'ai-plan-jobs';
const STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';

/**
 * POST /api/ai/jobs
 * 非同期ジョブを作成してキューに送信
 */
export async function POST(req: NextRequest) {
    try {
        // 認証チェック
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json();

        // ジョブドキュメントを作成
        const jobId = `job-${userId}-${Date.now()}`;
        const job: StudyPlanJob = {
            id: jobId,
            type: 'studyPlanJob',
            userId: userId,
            targetExam: body.targetExam || 'AP',
            status: 'pending',
            requestData: {
                targetExam: body.targetExam || 'AP',
                examDate: body.examDate,
                studyTimeWeekday: body.studyTimeWeekday,
                studyTimeWeekend: body.studyTimeWeekend,
                scores: body.scores || {},
            },
            createdAt: new Date().toISOString(),
        };

        // Cosmos DB に保存
        const container = await getContainer('PlanJobs');
        if (!container) {
            console.error('PlanJobs container not available');
            return NextResponse.json({ error: 'データベース接続エラー' }, { status: 500 });
        }

        await container.items.create(job);

        // Azure Queue にメッセージを送信
        if (STORAGE_CONNECTION_STRING) {
            try {
                const queueServiceClient = QueueServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING);
                const queueClient = queueServiceClient.getQueueClient(QUEUE_NAME);
                
                // メッセージを Base64 エンコード
                const message = JSON.stringify({
                    jobId: jobId,
                    userId: userId,
                    createdAt: job.createdAt,
                });
                const encodedMessage = Buffer.from(message).toString('base64');
                
                await queueClient.sendMessage(encodedMessage);
                console.log(`Queue message sent for job: ${jobId}`);
            } catch (queueError: any) {
                console.error('Failed to send queue message:', queueError);
                // キュー送信に失敗しても、ジョブは作成済みなので続行
                // 後でリトライ処理を実装可能
            }
        } else {
            console.warn('AZURE_STORAGE_CONNECTION_STRING not configured, queue message not sent');
        }

        return NextResponse.json(job, { status: 201 });

    } catch (error: any) {
        console.error('Failed to create job:', error);
        return NextResponse.json({
            error: 'ジョブの作成に失敗しました',
            details: error.message,
        }, { status: 500 });
    }
}

/**
 * GET /api/ai/jobs
 * ユーザーの最新ジョブを取得
 */
export async function GET(req: NextRequest) {
    try {
        // 認証チェック
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
        }

        const userId = session.user.id;

        const container = await getContainer('PlanJobs');
        if (!container) {
            return NextResponse.json({ error: 'データベース接続エラー' }, { status: 500 });
        }

        // userId パーティション内で最新のジョブを取得
        const { resources } = await container.items
            .query({
                query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC OFFSET 0 LIMIT 1',
                parameters: [{ name: '@userId', value: userId }],
            })
            .fetchAll();

        if (resources.length === 0) {
            return NextResponse.json(null);
        }

        return NextResponse.json(resources[0]);

    } catch (error: any) {
        console.error('Failed to get job:', error);
        return NextResponse.json({
            error: 'ジョブの取得に失敗しました',
            details: error.message,
        }, { status: 500 });
    }
}
