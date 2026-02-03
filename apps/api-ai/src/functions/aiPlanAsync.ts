/**
 * aiPlanAsync - Queue Trigger Function
 * 
 * Azure Queue Storage からメッセージを受け取り、
 * バックグラウンドで AI 学習計画を生成して Cosmos DB に保存する
 */

import { app, InvocationContext } from "@azure/functions";
import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";
import { CosmosClient } from "@azure/cosmos";

interface QueueMessage {
    jobId: string;
    userId: string;
    createdAt: string;
}

interface StudyPlanJob {
    id: string;
    type: "studyPlanJob";
    userId: string;
    targetExam: string;
    status: "pending" | "processing" | "completed" | "failed";
    requestData: {
        targetExam: string;
        examDate: string;
        studyTimeWeekday: number;
        studyTimeWeekend: number;
        scores: Record<string, number>;
    };
    resultData?: any;
    error?: string;
    createdAt: string;
    processingStartedAt?: string;
    completedAt?: string;
}

// Schema for plan generation (same as aiPlan.ts)
const planSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        title: { type: SchemaType.STRING, description: "日本語の計画タイトル" },
        examDate: { type: SchemaType.STRING },
        monthlyGoal: { type: SchemaType.STRING, description: "日本語の今月の目標" },
        weeklySchedule: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    weekNumber: { type: SchemaType.NUMBER },
                    startDate: { type: SchemaType.STRING },
                    endDate: { type: SchemaType.STRING },
                    theme: { type: SchemaType.STRING, description: "日本語の週テーマ" },
                    goal: { type: SchemaType.STRING, description: "日本語の週目標" },
                    dailyTasks: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                date: { type: SchemaType.STRING },
                                missionTitle: { type: SchemaType.STRING, description: "日本語のミッション名" },
                                goal: { type: SchemaType.STRING, description: "日本語の詳細目標" },
                                questionCount: { type: SchemaType.NUMBER },
                                targetCategory: { type: SchemaType.STRING, description: "日本語カテゴリ" },
                                targetExamId: { type: SchemaType.STRING, nullable: true },
                                difficulty: { type: SchemaType.STRING, description: "easy/normal/hard" },
                                xpReward: { type: SchemaType.NUMBER, description: "獲得XP（10-100）" }
                            },
                        },
                    },
                },
            },
        },
        generatedAt: { type: SchemaType.STRING }
    },
    required: ["title", "examDate", "monthlyGoal", "weeklySchedule", "generatedAt"]
};

// Lazy CosmosDB client
let cosmosClient: CosmosClient | undefined;
const getCosmosClient = () => {
    if (!cosmosClient && process.env.COSMOS_DB_CONNECTION) {
        cosmosClient = new CosmosClient(process.env.COSMOS_DB_CONNECTION);
    }
    return cosmosClient;
};

/**
 * Queue Trigger Handler
 */
export async function aiPlanAsync(queueItem: unknown, context: InvocationContext): Promise<void> {
    const startTime = Date.now();
    context.log("Queue trigger received message");

    let message: QueueMessage;
    
    try {
        // Queue message is Base64 encoded
        if (typeof queueItem === 'string') {
            const decoded = Buffer.from(queueItem, 'base64').toString('utf-8');
            message = JSON.parse(decoded);
        } else {
            message = queueItem as QueueMessage;
        }
    } catch (e) {
        context.error("Failed to parse queue message:", e);
        return;
    }

    const { jobId, userId } = message;
    context.log(`Processing job: ${jobId} for user: ${userId}`);

    const client = getCosmosClient();
    if (!client) {
        context.error("Cosmos DB client not available");
        return;
    }

    const container = client.database("pm-exam-dx-db").container("PlanJobs");

    try {
        // 1. Fetch job from Cosmos DB
        const { resource: job } = await container.item(jobId, userId).read<StudyPlanJob>();
        
        if (!job) {
            context.error(`Job not found: ${jobId}`);
            return;
        }

        if (job.status !== 'pending') {
            context.log(`Job ${jobId} is not pending (status: ${job.status}), skipping.`);
            return;
        }

        // 2. Update status to processing
        job.status = 'processing';
        job.processingStartedAt = new Date().toISOString();
        await container.item(jobId, userId).replace(job);

        // 3. Generate plan using Gemini
        const apiKey = process.env.GEMINI_API_KEY || "";
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not configured");
        }

        const { targetExam, examDate, studyTimeWeekday, studyTimeWeekend, scores } = job.requestData;
        const today = new Date().toISOString().split('T')[0];

        const prompt = buildPrompt(targetExam, examDate, studyTimeWeekday, studyTimeWeekend, scores, today);

        const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
        let validPlan: any = null;
        let lastError: any = null;

        const genAI = new GoogleGenerativeAI(apiKey);

        for (const modelName of MODELS) {
            try {
                context.log(`Trying model: ${modelName}`);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: planSchema
                    }
                });

                const result = await model.generateContent(prompt);
                const text = result.response.text();

                if (text) {
                    validPlan = JSON.parse(text);
                    context.log(`Success with model: ${modelName}`);
                    break;
                }
            } catch (e: any) {
                lastError = e;
                context.warn(`Failed with Model ${modelName}: ${e.message}`);
            }
        }

        if (!validPlan) {
            throw lastError || new Error("All models failed.");
        }

        validPlan.generatedAt = today;

        // 4. Update job with result
        job.status = 'completed';
        job.resultData = validPlan;
        job.completedAt = new Date().toISOString();
        await container.item(jobId, userId).replace(job);

        const duration = Date.now() - startTime;
        context.log(`Job ${jobId} completed in ${duration}ms`);

        // Save metrics
        try {
            const metricsContainer = client.database("pm-exam-dx-db").container("Metrics");
            await metricsContainer.items.create({
                id: `async-${jobId}`,
                type: 'plan_generation_async',
                jobId,
                userId,
                targetExam,
                duration,
                createdAt: new Date().toISOString()
            });
        } catch (metricErr) {
            context.error('Failed to save metric:', metricErr);
        }

    } catch (error: any) {
        context.error(`Job ${jobId} failed:`, error.message);

        // Update job status to failed
        try {
            const { resource: job } = await container.item(jobId, userId).read<StudyPlanJob>();
            if (job) {
                job.status = 'failed';
                job.error = error.message || String(error);
                job.completedAt = new Date().toISOString();
                await container.item(jobId, userId).replace(job);
            }
        } catch (updateErr) {
            context.error('Failed to update job status:', updateErr);
        }
    }
}

/**
 * Build the prompt for Gemini (same as aiPlan.ts)
 */
function buildPrompt(
    targetExam: string,
    examDate: string,
    studyTimeWeekday: number,
    studyTimeWeekend: number,
    scores: Record<string, number>,
    today: string
): string {
    return `
あなたは日本の情報処理技術者試験専門の学習コーチです。
「${targetExam}」試験の合格に向けた、ゲーム感覚で楽しく学習できる計画を作成してください。

【重要】すべての出力は必ず日本語で記述してください。英語は一切使用しないでください。

# ユーザー情報
- 受験日: ${examDate}
- 今日の日付: ${today}
- 平日の学習時間: ${studyTimeWeekday}時間/日
- 休日の学習時間: ${studyTimeWeekend}時間/日
- 自己評価: ${JSON.stringify(scores)}（数値が低い分野を重点的に強化）

# 出力ルール

## 1. title（計画タイトル）
- 必ず日本語で記述
- モチベーションが上がるキャッチーなタイトル

## 2. monthlyGoal（今月の目標）
- 必ず日本語で記述
- 具体的で達成可能な目標

## 3. weeklySchedule（週間スケジュール）

### theme（週テーマ）
- 必ず日本語で記述

### goal（週目標）
- 必ず日本語で記述

## 4. dailyTasks（日次ミッション）

### missionTitle（ミッション名）
- 必ず日本語で、短く印象的に
- ゲーム風の表現を推奨

### goal（詳細目標）
- 必ず日本語で記述

### targetCategory（対象カテゴリ）
- 必ず日本語のカテゴリ名を使用
- 使用可能: セキュリティ、ネットワーク、データベース、アルゴリズム、システム開発、プロジェクトマネジメント、経営戦略、情報戦略、基礎理論、コンピュータシステム

### difficulty（難易度）
- easy: 復習・基礎（XP低め）
- normal: 標準レベル（XP標準）
- hard: 応用・難問（XP高め）

### xpReward（獲得XP）
- easy: 10-30
- normal: 30-50
- hard: 50-100

## 5. 問題数の計算
- 1問あたり約15分を想定
- 2時間 = 約8問、3時間 = 約12問

## 6. スコープ制限
- 試験日までの全週のweeklyScheduleを生成（最大12週）
- 詳細なdailyTasksは最初の4週間のみ生成
- 5週目以降はtheme/goalのみ設定し、dailyTasksは空配列

## 7. 日付形式
- date: YYYY-MM-DD形式
- generatedAt: 今日の日付 ${today}
`;
}

// Register Queue Trigger function
app.storageQueue("aiPlanAsync", {
    queueName: "ai-plan-jobs",
    connection: "AzureWebJobsStorage",
    handler: aiPlanAsync
});
