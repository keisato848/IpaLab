
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { CosmosClient } from '@azure/cosmos';
import * as dotenv from 'dotenv';
import * as https from 'https';
import { isLocalEmulatorConnection } from '../utils/cosmos-client';

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

const resolveQNo = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        const parsed = Number.parseInt(value.trim(), 10);
        return parsed > 0 ? parsed : null;
    }

    return null;
};

const hasOwnQNo = (value: unknown): boolean => {
    return typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'qNo');
};

// Clean invalid LearningRecords (missing required fields like answeredAt)
async function cleanLearningRecords() {
    if (!CONNECTION_STRING) {
        console.error("Error: COSMOS_DB_CONNECTION environment variable is not set.");
        process.exit(1);
    }

    const isLocal = isLocalEmulatorConnection(CONNECTION_STRING);
    let finalConnectionString = CONNECTION_STRING;
    let clientOptions: any = {};

    if (isLocal) {
        console.log("Detected Local Cosmos DB Emulator.");
        if (CONNECTION_STRING.includes('localhost')) {
            finalConnectionString = CONNECTION_STRING.replace('localhost', '127.0.0.1');
        } else if (CONNECTION_STRING.includes('host.docker.internal')) {
            finalConnectionString = CONNECTION_STRING;
        }
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        clientOptions = {
            connectionString: finalConnectionString,
            agent: new https.Agent({ rejectUnauthorized: false })
        };
    } else {
        console.log("Detected Cloud Cosmos DB connection.");
        clientOptions = { connectionString: finalConnectionString };
    }

    console.log(`Using Connection String Endpoint: ${finalConnectionString.split(';')[0]}`);

    const client = new CosmosClient(clientOptions);
    const database = client.database(DATABASE_NAME);
    
    // Ensure LearningRecords container exists
    await database.containers.createIfNotExists({ id: "LearningRecords", partitionKey: '/userId' });
    const container = database.container("LearningRecords");

    console.log("Fetching all LearningRecords...");
    
    const { resources: records } = await container.items
        .query("SELECT * FROM c")
        .fetchAll();

    console.log(`Found ${records.length} total records.`);

    let deletedCount = 0;
    let invalidRecords: { id: string; userId: string; reason: string }[] = [];

    for (const record of records) {
        const issues: string[] = [];
        
        // Check required fields
        if (!record.answeredAt) issues.push('missing answeredAt');
        if (!record.id) issues.push('missing id');
        if (!record.userId) issues.push('missing userId');
        if (!record.questionId) issues.push('missing questionId');
        if (!record.examId) issues.push('missing examId');
        if (typeof record.isCorrect !== 'boolean') issues.push('missing/invalid isCorrect');
        
        // Validate answeredAt format if present
        if (record.answeredAt) {
            const date = new Date(record.answeredAt);
            if (isNaN(date.getTime())) {
                issues.push('invalid answeredAt format');
            }
        }

        if (issues.length > 0) {
            invalidRecords.push({
                id: record.id || 'unknown',
                userId: record.userId || 'unknown',
                reason: issues.join(', ')
            });
        }
    }

    if (invalidRecords.length === 0) {
        console.log("✅ No invalid records found. Database is clean.");
        return;
    }

    console.log(`\n⚠️  Found ${invalidRecords.length} invalid records:`);
    invalidRecords.forEach(r => {
        console.log(`  - ID: ${r.id}, UserId: ${r.userId}, Reason: ${r.reason}`);
    });

    // Confirm deletion
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    const answer = await new Promise<string>((resolve) => {
        rl.question(`\nDelete these ${invalidRecords.length} invalid records? (y/N): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
        console.log("Aborted.");
        return;
    }

    // Delete invalid records
    for (const invalid of invalidRecords) {
        try {
            await container.item(invalid.id, invalid.userId).delete();
            deletedCount++;
            console.log(`  Deleted: ${invalid.id}`);
        } catch (err: any) {
            console.error(`  Failed to delete ${invalid.id}: ${err.message}`);
        }
    }

    console.log(`\n✅ Cleaned ${deletedCount} invalid records.`);
}

async function main() {
    if (!CONNECTION_STRING) {
        console.error("Error: COSMOS_DB_CONNECTION environment variable is not set.");
        // Try to hint where it might be looking
        console.log("Checked paths:", possibleEnvPaths);
        process.exit(1);
    }

    // Determine if we are using Local Emulator
    const isLocal = isLocalEmulatorConnection(CONNECTION_STRING);
    let finalConnectionString = CONNECTION_STRING;
    let clientOptions: any = {};

    if (isLocal) {
        console.log("Detected Local Cosmos DB Emulator.");
        if (CONNECTION_STRING.includes('localhost')) {
            finalConnectionString = CONNECTION_STRING.replace('localhost', '127.0.0.1');
        } else if (CONNECTION_STRING.includes('host.docker.internal')) {
            finalConnectionString = CONNECTION_STRING;
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
        // New Container for Predictive Metrics
        await database.containers.createIfNotExists({ id: "Metrics", partitionKey: '/type' });
        // Container for AI Plan Generation Jobs (async processing)
        // Partition Key: /userId でユーザー単位のクエリを効率化
        // TTL: 30日（2592000秒）は Azure Portal または CLI で設定済み
        await database.containers.createIfNotExists({ id: "PlanJobs", partitionKey: '/userId' });

        console.log("Database and Container ensured.");

        const dataDir = path.resolve(__dirname, '../../data/questions');
        const questionFiles = glob.sync('**/questions_raw.json', { cwd: dataDir });

        // Filter by argument if provided (e.g. --exam AP-2024-Fall-AM)
        const args = process.argv.slice(2);
        const examArgIdx = args.indexOf('--exam');
        const targetExam = examArgIdx !== -1 ? args[examArgIdx + 1] : null;

        if (targetExam) {
            console.log(`Filtering for exam: ${targetExam}`);
        }

        console.log(`Found ${questionFiles.length} question files (filtering for ${targetExam || 'ALL'}).`);

        const failedFolders: { folderName: string; message: string }[] = [];

        for (const file of questionFiles) {
            const dir = path.dirname(file);
            const folderName = dir.split(path.sep).pop()!;

            if (targetExam && folderName !== targetExam) {
                continue;
            }



            let yearStr = "2024";
            let seasonStr = "S";
            let examTypeRaw = "AM";
            let examPrefix = "AP";

            const parts = folderName.split('-');
            if (parts.length >= 3) {
                examPrefix = parts[0];
                yearStr = parts[1];
                const seasonRaw = parts[2]; // Spring/Fall/Public
                if (seasonRaw === 'Spring') seasonStr = 'S';
                else if (seasonRaw === 'Fall') seasonStr = 'F';
                else if (seasonRaw === 'Public') seasonStr = 'Public';
                else seasonStr = seasonRaw;
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

                // [NEW] Load Classification Data if available
                const classifiedPath = path.join(dataDir, folderName, 'questions_classified.json');
                let classificationMap = new Map<number, { category: string, subCategory: string }>();
                if (fs.existsSync(classifiedPath)) {
                    try {
                        const clsData = JSON.parse(fs.readFileSync(classifiedPath, 'utf-8'));
                        if (Array.isArray(clsData)) {
                            clsData.forEach((c: any) => {
                                const qNo = resolveQNo(c.qNo);
                                if (qNo) classificationMap.set(qNo, { category: c.category, subCategory: c.subCategory });
                            });
                            console.log(`Loaded classification data for ${folderName} (${classificationMap.size} items)`);
                        }
                    } catch (e) {
                        console.warn(`Failed to load classification data for ${folderName}`, e);
                    }
                }

                // Define questions FIRST because it is used in examItem stats
                const questions = Array.isArray(data) ? data : (data.questions || []);

                // 1. Upsert Exam
                // Generate Title
                let titlePrefix = "";
                if (examPrefix === 'AP') titlePrefix = "応用情報技術者";
                else if (examPrefix === 'FE') titlePrefix = "基本情報技術者";
                else if (examPrefix === 'PM') titlePrefix = "プロジェクトマネージャ";
                else if (examPrefix === 'SC') titlePrefix = "情報処理安全確保支援士";
                else if (examPrefix === 'SA') titlePrefix = "システムアーキテクト";
                else if (examPrefix === 'ST') titlePrefix = "ITストラテジスト";
                else if (examPrefix === 'IP') titlePrefix = "ITパスポート";

                let termStr = seasonStr === 'S' ? "春期" : (seasonStr === 'F' ? "秋期" : "公開問題");
                let typeLabel = "午前";
                if (examPrefix === 'FE' && parseInt(yearStr) >= 2023) {
                    if (type.startsWith('AM')) typeLabel = "科目A";
                    else if (type.startsWith('PM')) typeLabel = "科目B";
                } else if (examPrefix === 'IP') typeLabel = "公開問題";
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
                    date: `${yearStr}-${seasonStr === 'S' ? '04' : (seasonStr === 'F' ? '10' : '01')}-15`, // Approx date
                    stats: {
                        total: type.includes('PM') ? questions.length : (type === 'AM2' ? questions.length : questions.length * 20),
                        completed: 0,
                        correctRate: 0
                    }
                };

                const examsContainer = database.container(EXAM_CONTAINER_NAME);
                await examsContainer.items.upsert(examItem);

                console.log(`Upserted Exam: ${examId} into Exams container`);

                // 2. Upsert Questions
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

                        // data が配列の場合（複数大問がある場合）は各要素を個別にドキュメント化。
                        // Form C の { questions: [...] } ラッパーは内側の questions を同期対象にする。
                        const hierarchicalItems = Array.isArray(data)
                            ? data
                            : hasOwnQNo(data)
                                ? [data]
                                : Array.isArray(data.questions)
                                    ? data.questions
                                    : [data];

                        for (const item of hierarchicalItems) {
                            // Determine Parent QNo
                            let parentQNo = resolveQNo(item.qNo);
                            if (!parentQNo && item.theme) parentQNo = extractQNo(item.theme);
                            if (!parentQNo && item.description) parentQNo = extractQNo(item.description);
                            if (!parentQNo) {
                                throw new Error(`Missing qNo for hierarchical PM item in ${folderName}. Refusing to sync placeholder qNo=99.`);
                            }

                            // Determine Description/Context
                            const contextObj = item.context || null;
                            const descriptionText = contextObj ? contextObj.background : (item.description || "");

                            // サブクエスチョン: item.questions（3階層）または item.subQuestions（2階層）
                            const subQuestions = item.questions || item.subQuestions || [];

                            itemsToUpsert.push({
                                id: `${examId}-${parentQNo}`,
                                examId: examId,
                                type: type,
                                qNo: parentQNo,
                                text: item.theme || `問${parentQNo}`,
                                description: descriptionText,
                                context: contextObj,
                                explanation: item.explanation || undefined,
                                questions: subQuestions
                            });
                        }

                    } else { // --- Case B: Flat List (AM Exams, SC AM2, or PM Independent Questions) ---
                        // This preserves the original logic for AM exams.

                        for (const [questionIndex, questionItem] of questions.entries()) {
                            const resolvedQNo = resolveQNo(questionItem.qNo);
                            if (!resolvedQNo) {
                                throw new Error(`Missing qNo for flat question index=${questionIndex} in ${folderName}. Refusing to sync placeholder qNo=99.`);
                            }

                            // PM/Afternoon logic (often nested)
                            if (type.startsWith('PM') || type === 'AM2' || examPrefix === 'PM' || examPrefix === 'SC') {
                                // PM AM2 is Multiple Choice
                                if (questionItem.options && questionItem.options.length > 0) {
                                    itemsToUpsert.push({
                                        id: `${examId}-${resolvedQNo}`,
                                        examId: examId,
                                        type: type,
                                        qNo: resolvedQNo,
                                        text: questionItem.text,
                                        category: classificationMap.get(resolvedQNo)?.category || examPrefix, // Fallback to examPrefix if missing
                                        subCategory: classificationMap.get(resolvedQNo)?.subCategory || undefined,
                                        options: questionItem.options,
                                        correctOption: questionItem.correctOption,
                                        explanation: questionItem.explanation
                                    });
                                } else {
                                    // Descriptive Question but NOT a subquestion (Legacy/Fallback)
                                    // Or a collection of Descriptive Questions that are independent
                                    itemsToUpsert.push({
                                        id: `${examId}-${resolvedQNo}`,
                                        examId: examId,
                                        type: type,
                                        qNo: resolvedQNo,
                                        subQNo: questionItem.subQNo,
                                        text: questionItem.text || questionItem.theme || "（記述式問題）",
                                        theme: questionItem.theme,
                                        description: questionItem.description || data.description,
                                        questions: questionItem.questions || questionItem.subQuestions
                                    });
                                }
                            } else {
                                // Standard AM (AP/FE) - STRICTLY HERE
                                itemsToUpsert.push({
                                    id: `${examId}-${resolvedQNo}`,
                                    examId: examId,
                                    type: type,
                                    qNo: resolvedQNo,
                                    text: questionItem.text,
                                    category: classificationMap.get(resolvedQNo)?.category || examPrefix,
                                    subCategory: classificationMap.get(resolvedQNo)?.subCategory || undefined,
                                    diagram: questionItem.diagram, // Fix for Issue #22
                                    options: questionItem.options,
                                    correctOption: questionItem.correctOption,
                                    explanation: questionItem.explanation
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

                // --- 3. Prune Orphaned Questions (Mirror Sync) ---
                const upsertedIds = new Set(itemsToUpsert.map(i => i.id));

                // Fetch ALL existing questions for this exam from DB
                const querySpec = {
                    query: "SELECT c.id FROM c WHERE c.examId = @examId",
                    parameters: [{ name: "@examId", value: examId }]
                };

                const { resources: existingQuestions } = await questionContainer.items.query(querySpec).fetchAll();

                let prunedCount = 0;
                for (const existingQ of existingQuestions) {
                    if (!upsertedIds.has(existingQ.id)) {
                        console.log(`[PRUNE] Deleting orphaned question: ${existingQ.id}`);
                        await questionContainer.item(existingQ.id, examId).delete();
                        prunedCount++;
                    }
                }

                if (prunedCount > 0) {
                    console.log(`Pruned ${prunedCount} orphaned questions for ${examId}`);
                }

            } catch (err: any) {
                console.error(`Failed to process ${folderName}:`, err.message);
                failedFolders.push({ folderName, message: err.message });
                continue;
            }
        }

        if (failedFolders.length > 0) {
            failedFolders.forEach(({ folderName, message }) => {
                console.error(`[FAILED] ${folderName}: ${message}`);
            });
            throw new Error(`Failed to sync ${failedFolders.length} exam folder(s).`);
        }

        console.log("Done.");
    } catch (e: any) {
        console.error("Error during sync:", e?.message || e);
        process.exitCode = 1;
    }

}


// Main entry point with command routing
const args = process.argv.slice(2);
const command = args[0];

if (command === 'clean' || command === '--clean') {
    cleanLearningRecords().catch(err => {
        console.error(err);
        process.exit(1);
    });
} else {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
