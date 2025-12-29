import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { initDatabase } from "../services/cosmos";

export async function initDb(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Initializing Database...`);

    try {
        await initDatabase();
        return { body: "Database initialized successfully" };
    } catch (error) {
        context.error(error);
        return { status: 500, body: `Error initializing database: ${error}` };
    }
};

app.http('initDb', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: initDb
});
