
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { getContainer } from '@/lib/cosmos'; // Updated import
import { v4 as uuidv4 } from 'uuid';
import { getAppInsightsClient } from '@/lib/appinsights'; // Import client
import { getServerSession } from "next-auth"; // New import
import { authOptions } from "@/auth"; // New import

// ... (rest of imports/setup)


export const maxDuration = 60; // AI generation might take time
export const runtime = 'nodejs'; // Use Node runtime for stability

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

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    try {
        // Simple Key Selection (User requested no rotation)
        const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1 || '';

        if (!apiKey) {
            return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
        }

        const body: PlanRequest = await req.json();
        const { targetExam, examDate, studyTimeWeekday, studyTimeWeekend, scores } = body;
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
1. ** Title **: Create a catchy, motivating title(e.g., "AP合格 徹底攻略プラン").
        2. ** Strategies **:
- Calculate "questionCount" roughly assuming 15 minutes per question(review included).
             - Example: 2 hours -> ~8 questions.
           - Assign specific categories based on weak points in early weeks.
           - Use "targetExamId"(e.g., "AP-2023-Fall") for practice exam days(usually weekends).
        3. ** Scope Restriction **:
- Generate "weeklySchedule" for the entire period up to the exam(or max 12 weeks).
           - ** IMPORTANT: Only generate detailed "dailyTasks" for the FIRST 4 WEEKS.**
    - For weeks 5 +, provide the weekly "goal" but leave "dailyTasks" empty or minimal to save token space.
        4. ** Validation **:
- "date" must be YYYY - MM - DD.
           - "generatedAt" must be ISO string of now.
        `;

        const MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash"];
        let validPlan: any = null;
        let lastError: any = null;

        const genAI = new GoogleGenerativeAI(apiKey); // Initialize once

        for (const modelName of MODELS) {
            try {
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
                    break;
                }
            } catch (e: any) {
                lastError = e;
                console.warn(`Failed with Model ${modelName}: ${e.message} `);
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
            const container = await getContainer("Metrics");
            await container.items.create({
                id: uuidv4(),
                type: 'plan_generation',
                userId: body.userId || 'guest',
                targetExam,
                duration,
                createdAt: new Date().toISOString()
            });
        } catch (metricErr) {
            console.error('Failed to save metric:', metricErr);
        }

        return NextResponse.json(validPlan);

    } catch (error: any) {
        console.error('Plan generation failed:', error.message);
        return NextResponse.json({
            error: 'Failed to generate plan',
            details: error.message || String(error),
            models_tried: ["gemini-3-flash-preview", "gemini-2.5-flash"] // Debug info
        }, { status: 500 });
    }
}
