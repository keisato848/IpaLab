import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { learningRecordRepository } from "../repositories/learningRecordRepository";
import { LearningRecordSchema } from "@ipa-lab/shared";
import { z } from "zod";

export async function getLearningRecords(
    request: HttpRequest,
    context: InvocationContext,
    repo = learningRecordRepository
): Promise<HttpResponseInit> {
    const userId = request.query.get('userId');
    const examId = request.query.get('examId');

    if (!userId) {
        return { status: 400, body: "UserId is required" };
    }

    try {
        let records;
        if (examId) {
            records = await repo.listByUserAndExamId(userId, examId);
        } else {
            records = await repo.listByUserId(userId);
        }

        return {
            status: 200,
            jsonBody: records
        };
    } catch (error) {
        context.error(`Error fetching records: ${error}`);
        return { status: 500, body: "Internal Server Error" };
    }
}

export async function createLearningRecord(
    request: HttpRequest,
    context: InvocationContext,
    repo = learningRecordRepository
): Promise<HttpResponseInit> {
    try {
        const body = await request.json();

        // Check if body is array
        if (Array.isArray(body)) {
            // Bulk Insert
            const parseResults = z.array(LearningRecordSchema).safeParse(body);
            if (!parseResults.success) {
                return {
                    status: 400,
                    jsonBody: { error: "Invalid data in array", details: parseResults.error.errors }
                };
            }

            const records = parseResults.data;
            // Use Promise.all for parallel execution
            const savedRecords = await Promise.all(records.map(record => repo.save(record)));

            return {
                status: 201,
                jsonBody: { count: savedRecords.length, records: savedRecords }
            }

        } else {
            // Single Insert (Existing Logic)
            const result = LearningRecordSchema.safeParse(body);

            if (!result.success) {
                return {
                    status: 400,
                    jsonBody: { error: "Invalid data", details: result.error.errors }
                };
            }

            const record = result.data;
            const saved = await repo.save(record);

            return {
                status: 201,
                jsonBody: saved
            };
        }
    } catch (error) {
        context.error(`Error saving learning record: ${error}`);
        return {
            status: 500,
            jsonBody: { error: "Internal Server Error" }
        };
    }
}
