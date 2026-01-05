
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';
import * as https from 'https';

// Load env vars
// Try loading from web/api local.settings.json or .env.local
const possibleEnvPaths = [
    path.resolve(__dirname, '../../../../apps/web/.env.local'),
    path.resolve(__dirname, '../../../../apps/web/.env'),
    path.resolve(__dirname, '../../../../apps/api/local.settings.json')
];

for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        console.log(`Loading env from ${envPath}`);
        dotenv.config({ path: envPath });
    }
}

let CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION || process.env.Values_COSMOS_DB_CONNECTION;
// Logic moved inside main()

const DATABASE_NAME = "pm-exam-dx-db";
const CONTAINER_NAME = "Questions";
const EXAM_CONTAINER_NAME = "Exams";

const mapOptionToId = (jp: string): string | null => {
    const map: Record<string, string> = { 'ア': 'a', 'イ': 'b', 'ウ': 'c', 'エ': 'd' };
    return map[jp] || null;
};
// Simple types based on raw files
interface RawQuestion {
    qNo: number;
    text: string;
    options: { id: string, text: string }[];
    correctOption: string | null;
    category?: string;
    subCategory?: string;
}

interface ExplanationMap {
    [key: string]: string;
}

interface RawPMQuestion {
    qNo: number;
    theme?: string;
    description: string;
    questions: any[];
}

async function main() {
    if (!CONNECTION_STRING) {
        console.error("Error: COSMOS_DB_CONNECTION environment variable is not set.");
        // Try to hint where it might be looking
        console.log("Checked paths:", possibleEnvPaths);
        process.exit(1);
    }

    // Determine if we are using Local Emulator
    const isLocal = CONNECTION_STRING.includes('localhost') || CONNECTION_STRING.includes('127.0.0.1');
    let finalConnectionString = CONNECTION_STRING;
    let clientOptions: any = {};

    if (isLocal) {
        console.log("Detected Local Cosmos DB Emulator.");
        if (CONNECTION_STRING.includes('localhost')) {
            finalConnectionString = CONNECTION_STRING.replace('localhost', '127.0.0.1');
        }
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        clientOptions = {
            connectionString: finalConnectionString,
            agent: new https.Agent({ rejectUnauthorized: false })
        };
    } else {
        console.log("Detected Cloud Cosmos DB connection.");
        clientOptions = {
            connectionString: finalConnectionString
        };
    }

    console.log(`Using Connection String Endpoint: ${finalConnectionString.split(';')[0]}`);

    try {
        const client = new CosmosClient(clientOptions);
        const database = client.database(DATABASE_NAME);
        const container = database.container(CONTAINER_NAME);

        // Create DB/Container if not exists
        console.log("Ensuring Database and Container exist...");
        await client.databases.createIfNotExists({ id: DATABASE_NAME });
        await database.containers.createIfNotExists({ id: CONTAINER_NAME, partitionKey: '/examId' });
        await database.containers.createIfNotExists({ id: EXAM_CONTAINER_NAME, partitionKey: '/id' });

        console.log("Database and Container ensured.");

        const dataDir = path.resolve(__dirname, '../../data/questions');
        const questionFiles = glob.sync('**/questions_raw.json', { cwd: dataDir });

        console.log(`Found ${questionFiles.length} question files.`);

        for (const file of questionFiles) {
            const dir = path.dirname(file);
            const folderName = dir.split(path.sep).pop()!;

            let yearStr = "2024";
            let seasonStr = "S";
            let examTypeRaw = "AM";
            let examPrefix = "AP";

            const parts = folderName.split('-');
            if (parts.length >= 3) {
                examPrefix = parts[0];
                yearStr = parts[1];
                const seasonRaw = parts[2]; // Spring/Fall
                seasonStr = seasonRaw === 'Spring' ? 'S' : 'F';
                if (parts.length >= 4) {
                    examTypeRaw = parts[3];
                }
            }

            const examId = folderName; // Use full folder name (e.g. AP-2024-Spring-PM) as logic ID
            // const abbreviatedId = `${examPrefix}-${yearStr}${seasonStr}`; // OLD logic

            let type = 'AM1';
            if (examTypeRaw.includes('AM2')) type = 'AM2';
            else if (examTypeRaw.includes('PM1')) type = 'PM1';
            else if (examTypeRaw.includes('PM2')) type = 'PM2';
            else if (folderName.includes('PM')) type = 'PM'; // Fallback for PM folders without numerical suffix
            else type = 'AM1'; // Default

            try {
                // Check for questions_transformed.json first
                const transformedPath = path.join(dataDir, folderName, 'questions_transformed.json');
                const rawPath = path.join(dataDir, file);

                let content = "";
                let isTransformed = false;

                if (fs.existsSync(transformedPath)) {
                    console.log(`Using transformed data for ${folderName}`);
                    content = fs.readFileSync(transformedPath, 'utf8');
                    isTransformed = true;
                } else {
                    content = fs.readFileSync(rawPath, 'utf8');
                }

                const data = JSON.parse(content);

                // 1. Upsert Exam
                // Generate Title
                let titlePrefix = "";
                if (examPrefix === 'AP') titlePrefix = "応用情報技術者";
                else if (examPrefix === 'FE') titlePrefix = "基本情報技術者";
                else if (examPrefix === 'PM') titlePrefix = "プロジェクトマネージャ";
                else if (examPrefix === 'SC') titlePrefix = "情報処理安全確保支援士";
                else if (examPrefix === 'IP') titlePrefix = "ITパスポート";

                let termStr = seasonStr === 'S' ? "春期" : "秋期";
                let typeLabel = "午前";
                if (examPrefix === 'IP') typeLabel = "公開問題";
                else if (type === 'AM2') typeLabel = "午前II";
                else if (type === 'PM') typeLabel = "午後";
                else if (type === 'PM1') typeLabel = "午後I";
                else if (type === 'PM2') typeLabel = "午後II";

                const examTitle = `${yearStr}年度 ${termStr} ${titlePrefix} ${typeLabel}`;

                const examItem = {
                    id: examId,
                    title: examTitle,
                    category: examPrefix,
                    year: parseInt(yearStr),
                    term: seasonStr,
                    type: type,
                    date: `${yearStr}-${seasonStr === 'S' ? '04' : '10'}-15`, // Approx date
                    total: questions.length * (type.includes('PM') ? 1 : 20),
                    completed: 0,
                    correctRate: 0
                }
            };

            const examsContainer = database.container(EXAM_CONTAINER_NAME);
            await examsContainer.items.upsert(examItem);

            console.log(`Upserted Exam: ${examId} into Exams container`);

            // 2. Upsert Questions
            const questions = Array.isArray(data) ? data : (data.questions || []);
            const itemsToUpsert = [];

            if (Array.isArray(questions) && questions.length > 0) {

                // Helper to extract Question Number from text if qNo is missing
                const extractQNo = (text: string): number | null => {
                    if (!text) return null;
                    const match = text.match(/(?:問|Question|Big Question)\s*(\d+)/i);
                    return match ? parseInt(match[1], 10) : null;
                };

                const isPMExam = type.startsWith('PM') || examPrefix === 'PM' || (examPrefix === 'SC' && type !== 'AM2' && type !== 'AM1');

                // Case A trigger: Hierarchical flag OR Transformed file implies hierarchy
                const isHierarchical = (isPMExam && questions[0].subQNo !== undefined) || isTransformed;

                if (isHierarchical) {
                    // --- Case A: Hierarchical PM Question ---

                    // Determine Parent QNo
                    let parentQNo = (typeof data === 'object' && !Array.isArray(data)) ? data.qNo : null;
                    if (!parentQNo && data.theme) parentQNo = extractQNo(data.theme);
                    if (!parentQNo && data.description) parentQNo = extractQNo(data.description);
                    if (!parentQNo) parentQNo = 99; // Fallback

                    // Determine Description/Context
                    // New Schema has 'context' object. Old Schema has 'description' string.
                    // We map 'context' to 'context' field in DB, and keeping 'description' for backward compat or search if possible.
                    // If context exists, use context.background as description fallback?

                    const contextObj = data.context || null;
                    const descriptionText = contextObj ? contextObj.background : (data.description || "");

                    itemsToUpsert.push({
                        id: `${examId}-${parentQNo}`,
                        examId: examId,
                        type: type,
                        qNo: parentQNo,
                        text: data.theme || `問${parentQNo}`,
                        description: descriptionText,
                        context: contextObj, // NEW FIELD
                        questions: questions
                    });

                } else { // --- Case B: Flat List (AM Exams, SC AM2, or PM Independent Questions) ---
                    // This preserves the original logic for AM exams.

                    for (const q of questions) {
                        // For AM/Flat, we expect q.qNo to exist.
                        const resolvedQNo = q.qNo || 99;

                        // PM/Afternoon logic (often nested)
                        if (type.startsWith('PM') || type === 'AM2' || examPrefix === 'PM' || examPrefix === 'SC') {
                            // PM AM2 is Multiple Choice
                            if (q.options && q.options.length > 0) {
                                itemsToUpsert.push({
                                    id: `${examId}-${resolvedQNo}`,
                                    examId: examId,
                                    type: type,
                                    qNo: resolvedQNo,
                                    text: q.text,
                                    options: q.options,
                                    correctOption: q.correctOption,
                                    explanation: q.explanation
                                });
                            } else {
                                // Descriptive Question but NOT a subquestion (Legacy/Fallback)
                                // Or a collection of Descriptive Questions that are independent
                                itemsToUpsert.push({
                                    id: `${examId}-${resolvedQNo}`,
                                    examId: examId,
                                    type: type,
                                    qNo: resolvedQNo,
                                    subQNo: q.subQNo,
                                    text: q.text || q.theme || "（記述式問題）",
                                    theme: q.theme,
                                    description: q.description || data.description,
                                    questions: q.questions || q.subQuestions
                                });
                            }
                        } else {
                            // Standard AM (AP/FE) - STRICTLY HERE
                            itemsToUpsert.push({
                                id: `${examId}-${resolvedQNo}`,
                                examId: examId,
                                type: type,
                                qNo: resolvedQNo,
                                text: q.text,
                                options: q.options,
                                correctOption: q.correctOption,
                                explanation: q.explanation
                            });
                        }
                    }
                }
            }

            // Actually upsert questions
            const questionContainer = database.container(CONTAINER_NAME);
            for (const item of itemsToUpsert) {
                await questionContainer.items.upsert(item);
            }
            console.log(`Upserted ${itemsToUpsert.length} questions for ${examId}`);
        } catch (err: any) {
            console.error(`Failed to process ${folderName}:`, err.message);
            continue;
        }
    }

        console.log("Done.");
} catch (e: any) {
    console.error("Error during sync:", e?.message || e);
}

}


main().catch(err => {
    console.error(err);
    process.exit(1);
});
