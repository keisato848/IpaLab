import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { questionRepository as cosmosRepo } from "../repositories/questionRepository";
import { localQuestionRepository as localRepo } from "../repositories/LocalQuestionRepository";

// Feature Flag: Use Local Data if env var is set
const USE_LOCAL_DATA = process.env.USE_LOCAL_DATA === 'true';

const repository = USE_LOCAL_DATA ? localRepo : cosmosRepo;

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
        return {
            status: 200,
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
