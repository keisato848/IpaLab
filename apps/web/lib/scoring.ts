
import { Question, LearningRecord } from './api';

export interface ExamResult {
    totalScore: number;       // Your calculated score (e.g. 72)
    totalPoints: number;      // Total possible points (e.g. 100)
    maxPossibleScore: number; // Max score for answered questions so far (progress based)
    percentage: number;       // 0-100
    isPassed: boolean;        // >= 60%
    answeredCount: number;
    questionCount: number;
}

export interface RadarData {
    subject: string;
    A: number;
    fullMark: number;
}

/**
 * Calculates the overall weighted score for an exam.
 * Formula: Sum( (aiScore / 100) * questionPoint )
 */
export function calculateExamResult(records: LearningRecord[], questions: Question[]): ExamResult {
    let totalScore = 0;
    let totalPoints = 0;
    let answeredCount = 0;

    // Filter to only PM/Descriptive questions if that's the scope, 
    // or handle all if we have points for everything. 
    // Currently, we only added points to PM sub-questions via cleanse.

    // We iterate through QUESTIONS to find total points (denominator)
    // and match records to find numerator.

    const relevantQuestions: { id: string; point: number }[] = [];

    // Flatten logic for PM questions
    questions.forEach(q => {
        if (q.subQuestions && q.subQuestions.length > 0) {
            q.subQuestions.forEach((sq, idx) => {
                // Determine ID - this is tricky if we don't have exact ID mapping
                // But our record saving logic uses `question.id` or constructed ID?
                // In QuestionClient, we saved with constructed ID? 
                // Let's assume Question ID in record matches what we can derive here.
                // However, raw questions don't have unique IDs for subquestions usually.
                // The cleanse script added points to the JSON structure.
                // The API / QuestionClient logic needs to agree on ID.

                // For now, let's look at how records are saved.
                // handleSaveAIScore in QuestionClient uses `getSubQId(currentSubQIndex, sIdx)`.
                // Format: `${question.id}-${sIdx}` (or with nested).

                // We need to replicate that ID generation or rely on `qNo`.
                // Actually, `c.questionId` in DB is unique. 
                // Our `Question` object from `questions` container might be the Top Level object.
                // We need to drill down.

                // ID Generation Strategy match QuestionClient:
                // QuestionClient: `${question.id}-${sIdx}` (nested not handled perfectly in client yet? check client)
                // Actually, let's assume `question.id` + suffix.

                // Simplification: We match record.questionId against our constructed list.
                // Or we can just sum up records and points if we assume 1-to-1?
                // No, totalPoints must include unanswered questions.

                const point = sq.point || 0;
                totalPoints += point;

                // We need to know which record corresponds to this sub-question.
                // If we can't easily match IDs, this calculation is hard.
                // BUT, in Phase 2, we synced data. 
                // Does `Question` interface have `subQuestions` with IDs? No.

                // Let's assume we can match based on record's `questionId` containing the base ID.
                // Better: iterate records and sum their points? No, that misses unanswered.

                // Let's store expected IDs to match.
                // Base ID: q.id (e.g. AP-2023-PM-01)
                // SubQ ID: AP-2023-PM-01-0 (Index 0)

                // Wait, Cleanse script didn't generate IDs for subquestions in the JSON.
                // The `QuestionClient` generates them on the fly?
                // Check QuestionClient saved ID format: `getSubQId`. 
                // `let id = ${question.id}-${sIdx}`

                relevantQuestions.push({
                    id: `${q.id}-${idx}`, // Simple 0-indexed suffix matches Client
                    point: point
                });
            });
        } else {
            // Flat question
            const point = q.point || (q.isPM ? 100 : 0); // Default 100 if single PM?
            if (q.isPM) { // Only count PM questions for this logic as per user context
                totalPoints += point;
                relevantQuestions.push({ id: q.id, point });
            }
        }
    });

    if (totalPoints === 0) {
        // Fallback or empty
        return {
            totalScore: 0,
            totalPoints: 0,
            maxPossibleScore: 0,
            percentage: 0,
            isPassed: false,
            answeredCount: 0,
            questionCount: relevantQuestions.length
        };
    }

    // Now calculate score
    relevantQuestions.forEach(qItem => {
        // Find record
        const record = records.find(r => r.questionId === qItem.id);
        if (record) {
            answeredCount++;
            if (record.isDescriptive && record.aiScore !== undefined) {
                // Formula: (aiScore / 100) * point
                const weighted = (record.aiScore / 100) * qItem.point;
                totalScore += weighted;
            }
        }
    });

    const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;

    return {
        totalScore: Math.round(totalScore * 10) / 10, // 1 decimal
        totalPoints,
        maxPossibleScore: totalPoints, // Simplified
        percentage,
        isPassed: percentage >= 60,
        answeredCount,
        questionCount: relevantQuestions.length
    };
}

/**
 * Aggregates Radar Chart data (CLKS) from all records.
 */
export function calculateAggregatedRadar(records: LearningRecord[]): RadarData[] {
    // CLKS keys
    const sums: Record<string, { total: number; count: number }> = {
        '設問適合性': { total: 0, count: 0 }, // Context
        '論理構成': { total: 0, count: 0 },   // Logic
        '重要語句': { total: 0, count: 0 },   // Keyword
        '具体性': { total: 0, count: 0 }      // Specificity
    };

    // Also handle English keys if API returns them? 
    // Prompt said: Context, Logic, Keyword, Specificity. 
    // API returns Japanese keys: "設問適合性", "論理構成"...

    records.forEach(r => {
        if (r.isDescriptive && r.aiRadarData) {
            r.aiRadarData.forEach((item: any) => {
                if (sums[item.subject]) {
                    sums[item.subject].total += item.A;
                    sums[item.subject].count++;
                }
            });
        }
    });

    return Object.keys(sums).map(subject => {
        const data = sums[subject];
        const avg = data.count > 0 ? data.total / data.count : 0;
        return {
            subject,
            A: Math.round(avg * 10) / 10, // 1 decimal
            fullMark: 10
        };
    });
}
