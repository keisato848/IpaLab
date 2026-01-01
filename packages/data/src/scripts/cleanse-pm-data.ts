
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const DATA_DIR = path.resolve(__dirname, '../../data/questions');

function cleanseData() {
    console.log(`Starting Data Cleansing in ${DATA_DIR}...`);

    // Find all PM questions
    const files = glob.sync('**/*PM*/questions_raw.json', { cwd: DATA_DIR });
    console.log(`Found ${files.length} PM question files.`);

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        const originalContent = fs.readFileSync(filePath, 'utf8');
        let data: any;

        try {
            data = JSON.parse(originalContent);
        } catch (e) {
            console.error(`Failed to parse JSON: ${file}`);
            continue;
        }

        // PM questions are single objects in our current schema for raw files
        if (!data.questions || !Array.isArray(data.questions)) {
            console.warn(`Skipping ${file}: Unexpected format (no questions array)`);
            continue;
        }

        let modified = false;

        // 1. Calculate base points per sub-question pair
        // Structure: data.questions = [{ label: "設問1", text: "...", subQuestions: [{ label: "(1)", text: "..." }] }]
        // We want to distribute 100 points across total LEAF sub-questions.

        let totalLeafQuestions = 0;
        data.questions.forEach((q: any) => {
            if (q.subQuestions && q.subQuestions.length > 0) {
                totalLeafQuestions += q.subQuestions.length;
            } else {
                totalLeafQuestions += 1; // Itself is a question
            }
        });

        const pointPerQ = totalLeafQuestions > 0 ? Math.floor(100 / totalLeafQuestions) : 0;
        const remainder = totalLeafQuestions > 0 ? 100 % totalLeafQuestions : 0;

        let allocatedCount = 0;

        // 2. Process Questions
        data.questions.forEach((q: any) => {
            // MERMAID FIX: Cleanse text in label/text if needed (rare)
            // Usually mermaid is in Description (data.description) or SubQuestion Text
            // We fix data.description too

            if (q.subQuestions && q.subQuestions.length > 0) {
                q.subQuestions.forEach((sq: any) => {
                    // Fix Mermaid in sq.text
                    if (sq.text && sq.text.includes('mermaid')) {
                        let newText = sq.text;
                        // 1. Fix "note:" -> "%% note:" (Comment out invalid notes)
                        newText = newText.replace(/(\n\s*)note:/gi, '$1%% note:');

                        // 2. Fix invalid participant names (e.g. "User(Browser)" -> "User")
                        // Mermaid doesn't like parentheses in aliases without quotes.
                        // Ideally we replace aliases like "A(Desc)" with "A".
                        // This is complex, but let's try to quote them if problematic?
                        // Or just simplistic fix for common Gemini output "Participant A (Role)" -> "Participant A"

                        // 3. Ensure sequenceDiagram header is present if arrows exist
                        if (newText.includes('->') && !newText.includes('sequenceDiagram')) {
                            newText = '```mermaid\nsequenceDiagram\n' + newText.replace('```mermaid', '');
                        }

                        if (sq.text !== newText) {
                            sq.text = newText;
                            modified = true;
                        }
                    }

                    // Add Points
                    if (sq.point === undefined || sq.point === null) {
                        // Distribute remainder to first few questions
                        const extra = allocatedCount < remainder ? 1 : 0;
                        sq.point = pointPerQ + extra;
                        allocatedCount++;
                        modified = true;
                    }
                });
            } else {
                // Flat question
                if (q.point === undefined || q.point === null) {
                    const extra = allocatedCount < remainder ? 1 : 0;
                    q.point = pointPerQ + extra;
                    allocatedCount++;
                    modified = true;
                }
            }
        });

        // 3. Process Main Description (Mermaid Fix)
        if (data.description) {
            const oldDesc = data.description;
            // Common pattern: lines starting with "note:" inside mermaid block
            let newDesc = data.description.replace(/(\n\s*)note:/gi, '$1%% note:');

            // Another fix: invalid "end" in some diagrams?
            // For now, note: is the main culprit.

            if (oldDesc !== newDesc) {
                data.description = newDesc;
                modified = true;
                console.log(`Fixed Mermaid in Description: ${file}`);
            }
        }

        if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            console.log(`Updated: ${file}`);
        }
    }
}

cleanseData();
