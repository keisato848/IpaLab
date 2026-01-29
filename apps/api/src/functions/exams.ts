import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { localExamRepository } from "../repositories/LocalExamRepository";
import { createHash } from 'crypto';

// Helper: Generate ETag from content
const generateETag = (data: unknown): string => {
    const hash = createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `"${hash}"`;
};

export async function getExams(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log('Fetching list of exams');

    try {
        const exams = await localExamRepository.list();
        const etag = generateETag(exams);

        // Check If-None-Match for conditional request
        const clientETag = request.headers.get('If-None-Match');
        if (clientETag === etag) {
            return {
                status: 304,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'ETag': etag,
                    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
                }
            };
        }

        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
                'ETag': etag
            },
            jsonBody: exams
        };
    } catch (error) {
        context.error(`Error fetching exams: ${error}`);
        return { status: 500, body: "Internal Server Error" };
    }
}

app.http("exams", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "exams",
    handler: getExams
});
