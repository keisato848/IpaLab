// apps/web/scripts/test-db-access.ts
import { getExamData } from '../lib/ssg-helper'; // 修正したヘルパー関数
import { getAllExamIds } from '../lib/ssg-helper';
import { containers } from '../lib/services/cosmos'; // Cosmos DBの初期化用
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
    
    // DB 接続を初期化 (念のため)
    // initDatabase() はサービス側なので、containers.questions にアクセスするだけで初期化されるはず
    try {
        // 全ての試験IDを取得
        console.log("Fetching all exam IDs from DB...");
        const allExamIds = await getAllExamIds();
        console.log(`Found ${allExamIds.length} exam IDs:`, allExamIds);

        if (allExamIds.length === 0) {
            console.warn("No exam IDs found in DB. Please ensure data is synced to Cosmos DB via 'npm run sync-db -w packages/data'.");
            return;
        }

        // 最初の試験IDを使って問題データを取得
        const testExamId = allExamIds[0];
        console.log(`Fetching questions for exam ID: ${testExamId} from DB...`);
        const questions = await getExamData(testExamId);

        console.log(`Found ${questions.length} questions for ${testExamId}.`);
        if (questions.length > 0) {
            console.log("First question example:", JSON.stringify(questions[0], null, 2));
        } else {
            console.warn(`No questions found for ${testExamId}.`);
        }

        console.log("DB access test completed successfully.");
    } catch (error) {
        console.error("DB access test failed:", error);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error("Unhandled error during DB access test:", err);
    process.exit(1);
});
