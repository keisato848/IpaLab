
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import JSON5 from 'json5';

const DATA_DIR = path.resolve(__dirname, '../../data/questions');

function cleanseData() {
    console.log(`Starting Data Cleansing in ${DATA_DIR}...`);

    // Find all PM questions
    // Find all Advanced questions (PM, SC, SA, ST, etc.)
    const files = glob.sync('**/*{PM,SC,SA,ST}*/questions_raw.json', { cwd: DATA_DIR });
    console.log(`Found ${files.length} PM question files.`);

    // Helper to strip markdown
    const cleanJson = (str: string) => {
        return str
            .replace(/^```json\s*/, "")
            .replace(/^```\s*/, "")
            .replace(/\s*```$/, "")
            .trim();
    };

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        const originalContent = fs.readFileSync(filePath, 'utf8');
        let data: any;
        let modified = false;
        let lastErrorLine = -1;
        let repairSuccess = false;

        // Iterative repair strategy
        let contentToFix = cleanJson(originalContent).replace(/\r\n/g, '\n'); // Normalize line endings

        for (let attempt = 0; attempt < 50; attempt++) {
            try {
                data = JSON5.parse(contentToFix);
                repairSuccess = true;
                if (attempt > 0) {
                    console.log(`Successfully repaired ${file} after ${attempt} fixes.`);
                    modified = true;
                }
                break;
            } catch (err: any) {
                console.log(`[DEBUG] Attempt ${attempt} failed: ${err.message} (Line: ${err.lineNumber})`);

                if (err.lineNumber) {
                    const lines = contentToFix.split('\n');
                    const lineIdx = err.lineNumber - 1; // JSON5 uses 1-based indexing

                    // Strategy: Quote Fix (Prioritize for long lines or stuck loops)
                    let handled = false;

                    if (lines[lineIdx] !== undefined) {
                        const line = lines[lineIdx];
                        // Try Quote Fix if line is long (likely description) or we are stuck
                        if (line.length > 200 || (attempt > 0 && err.lineNumber === lastErrorLine)) {
                            console.log(`[DEBUG] Line ${err.lineNumber} (Len: ${line.length}). Attempting Quote Fix.`);
                            const kvMatch = line.match(/^(\s*"[^"]+"\s*:\s*")(.+)$/);
                            if (kvMatch) {
                                const valuePrefix = kvMatch[1];
                                const rest = kvMatch[2];
                                const lastQuoteRelIdx = rest.lastIndexOf('"');

                                if (lastQuoteRelIdx >= 0) {
                                    const innerContent = rest.substring(0, lastQuoteRelIdx);
                                    const suffix = rest.substring(lastQuoteRelIdx);

                                    const escapedInner = innerContent.replace(/(\\*)(")/g, (match, backslashes, quote) => {
                                        return (backslashes.length % 2 === 1) ? match : backslashes + '\\"';
                                    });

                                    const newLine = valuePrefix + escapedInner + suffix;

                                    if (lines[lineIdx] !== newLine) {
                                        lines[lineIdx] = newLine;
                                        contentToFix = lines.join('\n');
                                        console.log(`[DEBUG] FIXED: Escaped quotes in line ${lineIdx + 1}`);
                                        handled = true;
                                    } else {
                                        console.log(`[DEBUG] Quote Fix made no changes.`);
                                    }
                                }
                            }
                        }
                    }

                    // Strategy: Merge (If Quote Fix didn't help)
                    if (!handled) {
                        if (lines[lineIdx] !== undefined) {
                            if (lineIdx > 0 && !/["},\]]\s*,?$/.test(lines[lineIdx - 1]) && !lines[lineIdx - 1].trim().endsWith('{')) {
                                console.log(`[DEBUG] Merging PREVIOUS: Line ${err.lineNumber} with Index ${lineIdx - 1}`);
                                lines[lineIdx - 1] = lines[lineIdx - 1] + "\\n" + lines[lineIdx];
                                lines.splice(lineIdx, 1);
                                contentToFix = lines.join('\n');
                                handled = true;
                            } else if (lines[lineIdx + 1] !== undefined) {
                                console.log(`[DEBUG] Merging NEXT: Line ${err.lineNumber} with Index ${lineIdx + 1}`);
                                lines[lineIdx] = lines[lineIdx] + "\\n" + lines[lineIdx + 1];
                                lines.splice(lineIdx + 1, 1);
                                contentToFix = lines.join('\n');
                                handled = true;
                            }
                        }
                    }

                    if (!handled) {
                        console.error(`Cannot repair ${file}: Error at line ${err.lineNumber}. stuck.`);
                        break;
                    }

                    lastErrorLine = err.lineNumber;
                } else {
                    console.error(`Cannot repair ${file}: No line info - ${err.message}`);
                    break;
                }
            }
        }

        if (!repairSuccess) {
            console.error(`Failed to parse JSON: ${file}`);
            continue;
        }

        // Normalize data structure
        // 1. If Array, wrap in { questions: data }
        if (Array.isArray(data)) {
            data = { questions: data };
            modified = true;
        }
        // 2. If Single Object without questions array, but looks like a question, wrap it
        else if (typeof data === 'object' && data !== null && !data.questions && (data.qNo || data.theme)) {
            data = { questions: [data] };
            modified = true;
        }

        // PM questions are single objects in our current schema for raw files
        if (!data.questions || !Array.isArray(data.questions)) {
            console.warn(`Skipping ${file}: Unexpected format (no questions array)`);
            continue;
        }

        // 1. Calculate base points per sub-question pair
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
            if (q.subQuestions && q.subQuestions.length > 0) {
                q.subQuestions.forEach((sq: any) => {
                    // Fix Mermaid in sq.text
                    if (sq.text && sq.text.includes('mermaid')) {
                        let newText = sq.text;
                        // 1. Fix "note:" -> "%% note:" (Comment out invalid notes)
                        newText = newText.replace(/(\n\s*)note:/gi, '$1%% note:');

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
