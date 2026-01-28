import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { getAppInsightsClient } from '@/lib/appinsights';

const apiKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEY_1 || "");
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
    try {
        const { targetExam, studyTimeWeekday, studyTimeWeekend, studyPeriod, scores } = await req.json();

        // Validate all required fields at once - fail fast if any are missing
        if (!targetExam || !scores || studyTimeWeekday === undefined || studyTimeWeekend === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Convert scores to text summary
        const scoreEntries = Object.entries(scores as Record<string, number>);
        const strengths = scoreEntries.filter(([_, v]) => v >= 4).map(([k]) => k).join(", ");
        const weaknesses = scoreEntries.filter(([_, v]) => v <= 2).map(([k]) => k).join(", ");
        const motivationScore = scores['motivation'] || 3;

        // Calculate total hours per week for reference
        const totalHours = (studyTimeWeekday * 5) + (studyTimeWeekend * 2);

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro",
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const prompt = `
        You are an expert study planner for IPA (Information-technology Promotion Agency, Japan) exams.
        Create 3 distinct study plan options for a user aiming to pass the ${targetExam} exam.

        User Profile:
        - Study Pattern:
          - Weekdays: ${studyTimeWeekday} hours/day
          - Weekends: ${studyTimeWeekend} hours/day
          - Total: approx ${totalHours} hours/week
        - Study Period: ${studyPeriod || "1"} month(s)
        - Self Assessment (1-5 scale):
          ${JSON.stringify(scores, null, 2)}
        
        - Derived Context:
          - Strengths: ${strengths || "None specific"}
          - Weaknesses: ${weaknesses || "None specific"}
          - Motivation Level: ${motivationScore}/5

        Please define 3 variations:
        1. Balanced Plan (Steady progress)
        2. Weakness Focus Plan (Prioritize overcoming weak points)
        3. Intensive/Sprint Plan (High intensity or high output focus)

        Please output a valid JSON object with the following structure:
        {
            "plans": [
                {
                    "title": "Title of the plan (e.g. Balanced Plan)",
                    "monthlyGoal": "A concise main goal for this month",
                    "weeklyPlan": [
                        {
                            "week": 1,
                            "focus": "Topic or focus area",
                            "tasks": ["Task 1", "Task 2", "Task 3"]
                        },
                        ... (for 4 weeks)
                    ],
                    "advice": "Specific advice for this approach"
                },
                ... (total 3 plans)
            ]
        }
        Do not include markdown code block markers. Just the JSON.
        Language: Japanese.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json(JSON.parse(responseText).plans);
    } catch (error: any) {
        console.error("AI Plan Generation Error:", error);

        const client = getAppInsightsClient();
        if (client) {
            client.trackException({ exception: error });
        }

        return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
    }
}
