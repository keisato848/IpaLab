import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { localExamRepository } from "../repositories/LocalExamRepository";

export async function getExams(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log('Fetching list of exams');

    try {
        const exams = await localExamRepository.list();
        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,OPTIONS',
                'Access-Control-Allow-Headers': '*'
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
