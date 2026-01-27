
import { getExamData, getAllExamIds } from '../lib/ssg-helper';
import { getContainer } from '../lib/cosmos';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local をロード
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTest() {
    console.log("Starting DB access test...");

    // Cosmos DB の接続文字列が存在するか確認
    if (!process.env.COSMOS_DB_CONNECTION) {
        console.error("COSMOS_DB_CONNECTION is not set. Please check .env.local or environment variables.");
        process.exit(1);
    }

    try {
        console.log("Testing DB connection...");
        const examsContainer = await getContainer("Exams");
        if (!examsContainer) {
<<<<<<< Updated upstream
            console.error("Failed to connect to Exams container.");
            process.exit(1);
=======
             throw new Error("Failed to get Exams container");
>>>>>>> Stashed changes
        }
        const { resources: exams } = await examsContainer.items.readAll().fetchAll();
        console.log(`Found ${exams.length} exams in DB.`);

        if (exams.length === 0) {
            console.warn("No exam IDs found in DB.");
        }

        // Test SSG Helper
        const allExamIds = await getAllExamIds();
        console.log(`SSG Helper found ${allExamIds.length} exam IDs.`);

        if (allExamIds.length > 0) {
            const testExamId = allExamIds[0];
            console.log(`Fetching questions for ${testExamId}...`);
            const questions = await getExamData(testExamId);
            console.log(`Found ${questions.length} questions.`);
        }

    } catch (error) {
        console.error("Test failed:", error);
    }
}

runTest();
