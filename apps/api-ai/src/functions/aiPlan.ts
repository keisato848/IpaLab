import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";
import { CosmosClient } from "@azure/cosmos";
import { v4 as uuidv4 } from "uuid";

interface PlanRequest {
    userId?: string;
    targetExam: string;
    examDate: string;
    studyTimeWeekday: number;
    studyTimeWeekend: number;
    scores: Record<string, number>;
}

// Define the schema for Gemini to strictly follow
// ゲーミフィケーション対応: difficulty, xpReward を追加
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
                    theme: { type: SchemaType.STRING, description: "日本語の週テーマ（例: ネットワーク基礎）" },
                    goal: { type: SchemaType.STRING, description: "日本語の週目標" },
                    dailyTasks: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                date: { type: SchemaType.STRING },
                                missionTitle: { type: SchemaType.STRING, description: "日本語のミッション名（短く）" },
                                goal: { type: SchemaType.STRING, description: "日本語の詳細目標" },
                                questionCount: { type: SchemaType.NUMBER },
                                targetCategory: { type: SchemaType.STRING, description: "日本語カテゴリ（セキュリティ等）" },
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

export async function aiPlan(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const startTime = Date.now();
    context.log("AI Plan generation request received");

    try {
        const apiKey = process.env.GEMINI_API_KEY || "";

        if (!apiKey) {
            return {
                status: 500,
                jsonBody: { error: "API Key not configured" }
            };
        }

        const body: PlanRequest = await request.json() as PlanRequest;
        const { targetExam, examDate, studyTimeWeekday, studyTimeWeekend, scores } = body;

        // Validate all required fields at once - fail fast if any are missing
        if (!targetExam || !examDate || !scores || studyTimeWeekday === undefined || studyTimeWeekend === undefined) {
            return {
                status: 400,
                jsonBody: { error: "Missing required fields" }
            };
        }

        const today = new Date().toISOString().split('T')[0];

        // 完全日本語プロンプト + ゲーミフィケーション対応
        const prompt = `
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
- 例: 「${targetExam}完全制覇プラン」「合格への最短ルート」

## 2. monthlyGoal（今月の目標）
- 必ず日本語で記述
- 具体的で達成可能な目標
- 例: 「テクノロジ系の基礎を固め、午前試験で80%正答を目指す」

## 3. weeklySchedule（週間スケジュール）

### theme（週テーマ）
- 必ず日本語で記述
- その週の主要学習テーマ
- 例: 「セキュリティ基礎」「アルゴリズム強化週間」

### goal（週目標）
- 必ず日本語で記述
- 例: 「セキュリティ分野の正答率70%以上を達成」

## 4. dailyTasks（日次ミッション）

### missionTitle（ミッション名）
- 必ず日本語で、短く印象的に
- ゲーム風の表現を推奨
- 例: 「セキュリティの門番」「アルゴリズムチャレンジ」「DB探検隊」

### goal（詳細目標）
- 必ず日本語で記述
- 具体的な学習内容
- 例: 「暗号化技術の基礎問題を8問解く」

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
- 問題数と難易度に応じて設定

## 5. 問題数の計算
- 1問あたり約15分（復習含む）を想定
- 2時間 = 約8問、3時間 = 約12問

## 6. スコープ制限
- 試験日までの全週のweeklyScheduleを生成（最大12週）
- 【重要】詳細なdailyTasksは最初の4週間のみ生成
- 5週目以降はtheme/goalのみ設定し、dailyTasksは空配列にする

## 7. 日付形式
- date: YYYY-MM-DD形式
- generatedAt: 今日の日付 ${today}

# 禁止事項
- 英語での出力は一切禁止
- 抽象的すぎる目標設定は禁止
- 非現実的な問題数の設定は禁止
        `;

        // Use models that support generateContent in v1beta API
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
                // Continue to next model
            }
        }

        if (!validPlan) {
            throw lastError || new Error("All models failed.");
        }

        // Force the generated date to be today to strictly prevent hallucination
        validPlan.generatedAt = today;

        // Calculate and Save Metrics
        const duration = Date.now() - startTime;

        try {
            const client = getCosmosClient();
            if (client) {
                const container = client.database("pm-exam-dx-db").container("Metrics");
                await container.items.create({
                    id: uuidv4(),
                    type: 'plan_generation',
                    userId: body.userId || 'guest',
                    targetExam,
                    duration,
                    createdAt: new Date().toISOString()
                });
            }
        } catch (metricErr) {
            context.error('Failed to save metric:', metricErr);
        }

        return {
            status: 200,
            jsonBody: validPlan
        };

    } catch (error: any) {
        context.error('Plan generation failed:', error.message);
        return {
            status: 500,
            jsonBody: {
                error: 'Failed to generate plan',
                details: error.message || String(error),
                models_tried: ["gemini-2.5-flash", "gemini-2.0-flash"]
            }
        };
    }
}

app.http("aiPlan", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "ai/plan",
    handler: aiPlan
});
