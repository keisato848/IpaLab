import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { learningRecordRepository } from "../repositories/learningRecordRepository";
import { LearningRecordSchema } from "@ipa-lab/shared";
import { z } from "zod";

// Request Body Schema (omit server-generated fields if any, but repository expects full object mostly)
// We allow the client to send most fields, but we should probably validate/override server-side fields like 'id' if needed.
// For now, we trust the client to generate UUIDs or we let the repository handle it if we change the repository logic.
// The repository `save` method takes `LearningRecord` which includes `id`.
// Let's assume the client generates ID for offline support (optimistic UI), or we generate it here?
// Shared schema has `id: z.string().uuid()`.

export async function handleLearningRecords(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    if (request.method === 'POST') {
        return createLearningRecord(request, context);
    } else if (request.method === 'GET') {
        return getLearningRecords(request, context);
    }

    return { status: 405, body: "Method Not Allowed" };
}

async function getLearningRecords(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const userId = request.query.get('userId');
    const examId = request.query.get('examId');

    if (!userId) {
        return { status: 400, body: "UserId is required" };
    }

    try {
        let records;
        if (examId) {
            records = await learningRecordRepository.listByUserAndExamId(userId, examId);
        } else {
            records = await learningRecordRepository.listByUserId(userId);
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

async function createLearningRecord(
    request: HttpRequest,
    context: InvocationContext
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
            const savedRecords = [];
            // Ideally use transactions or bulk support, but for now simple loop
            for (const record of records) {
                const saved = await learningRecordRepository.save(record);
                savedRecords.push(saved);
            }

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
            const saved = await learningRecordRepository.save(record);

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

app.http('learningRecords', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'learning-records',
    handler: handleLearningRecords
});
