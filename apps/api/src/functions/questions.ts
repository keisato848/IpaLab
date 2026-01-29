import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { questionRepository as cosmosRepo } from "../repositories/questionRepository";
import { localQuestionRepository as localRepo } from "../repositories/LocalQuestionRepository";
import { createHash } from 'crypto';

// Feature Flag: Use Local Data if env var is set
const USE_LOCAL_DATA = process.env.USE_LOCAL_DATA === 'true';

const repository = USE_LOCAL_DATA ? localRepo : cosmosRepo;

// Helper: Generate ETag from content
const generateETag = (data: unknown): string => {
    const hash = createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `"${hash}"`;
};

export async function getQuestions(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    const examId = request.params.examId;
    if (!examId) {
        return { status: 400, body: "Exam ID is required" };
    }

    context.log(`Fetching questions for ${examId} (Source: ${USE_LOCAL_DATA ? 'Local File' : 'Cosmos DB'})`);

    try {
        const questions = await repository.listByExamId(examId);
        const etag = generateETag(questions);

        // Check If-None-Match for conditional request
        const clientETag = request.headers.get('If-None-Match');
        if (clientETag === etag) {
            return {
                status: 304,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'ETag': etag,
                    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
                }
            };
        }

        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,OPTIONS',
                'Access-Control-Allow-Headers': '*',
                // Questions rarely change - cache for 1 day, stale for 1 week
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                'ETag': etag
            },
            jsonBody: questions
        };
    } catch (error) {
        context.error(`Error fetching questions: ${error}`);
        return { status: 500, body: "Internal Server Error" };
    }
}

app.http("questions", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "exams/{examId}/questions",
    handler: getQuestions
});
