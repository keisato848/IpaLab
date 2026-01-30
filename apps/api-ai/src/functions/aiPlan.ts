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
const planSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        title: { type: SchemaType.STRING },
        examDate: { type: SchemaType.STRING },
        monthlyGoal: { type: SchemaType.STRING },
        weeklySchedule: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    weekNumber: { type: SchemaType.NUMBER },
                    startDate: { type: SchemaType.STRING },
                    endDate: { type: SchemaType.STRING },
                    goal: { type: SchemaType.STRING },
                    dailyTasks: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                date: { type: SchemaType.STRING },
                                goal: { type: SchemaType.STRING },
                                questionCount: { type: SchemaType.NUMBER },
                                targetCategory: { type: SchemaType.STRING },
                                targetExamId: { type: SchemaType.STRING, nullable: true }
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

        // Refined prompt
        const prompt = `
        You are an elite IT Exam Strategy Coach.
        Create a winning study plan for the "${targetExam}" exam.

        # Context
        - Exam Date: ${examDate}
        - Current Date: ${today}
        - Study Time: Weekday ${studyTimeWeekday} h, Weekend ${studyTimeWeekend} h
        - Self Assessment: ${JSON.stringify(scores)} (Focus on reinforcing weak areas)

        # Rules
        1. **Title**: Create a catchy, motivating title (e.g., "AP合格 徹底攻略プラン").
        2. **Strategies**:
           - Calculate "questionCount" roughly assuming 15 minutes per question (review included).
           - Example: 2 hours -> ~8 questions.
           - Assign specific categories based on weak points in early weeks.
           - Use "targetExamId" (e.g., "AP-2023-Fall") for practice exam days (usually weekends).
        3. **Scope Restriction**:
           - Generate "weeklySchedule" for the entire period up to the exam (or max 12 weeks).
           - **IMPORTANT: Only generate detailed "dailyTasks" for the FIRST 4 WEEKS.**
           - For weeks 5+, provide the weekly "goal" but leave "dailyTasks" empty or minimal to save token space.
        4. **Validation**:
           - "date" must be YYYY-MM-DD.
           - "generatedAt" must be ISO string of now.
        `;

        const MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash"];
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
                models_tried: ["gemini-3-flash-preview", "gemini-2.5-flash"]
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
