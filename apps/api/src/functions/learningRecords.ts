import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createLearningRecord, getLearningRecords } from "./learningRecordHandlers";

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

app.http('learningRecords', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'learning-records',
    handler: handleLearningRecords
});
