
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import pdf from 'pdf-parse';
import { EXAM_LIST } from '../scraper/exam-list';

const dataDir = path.resolve(__dirname, '../../data/questions');
const downloadsDir = path.resolve(__dirname, '../../data/downloads/answers');

if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

async function fixAnswers() {
    console.log("Starting Answer Fix Process...");
    console.log(`Found ${EXAM_LIST.length} exams in list.`);
    let processedCount = 0;

    for (const exam of EXAM_LIST.filter(e => ['FE', 'AP', 'SC', 'PM', 'AU', 'NW', 'IP'].includes(e.category))) {
        try {
            processedCount++;
            // Check for answerUrl or deduce it logic below

            const examId = `${exam.category}-${exam.year}-${exam.term}-${exam.type}`;
            console.log(`[${processedCount}/${EXAM_LIST.length}] Processing ${examId}...`);

            let targetUrl = (exam as any).answerUrl;
            if (!targetUrl && exam.url.endsWith('_qs.pdf')) {
                targetUrl = exam.url.replace('_qs.pdf', '_ans.pdf');
            }

            if (!targetUrl) {
                console.log(`Skipping ${examId} (No answer URL)`);
                continue;
            }

            // 1. Download Answer Key
            let pdfPath = path.join(downloadsDir, `${examId}_ans.pdf`);
            if (fs.existsSync(pdfPath)) {
                // Found in downloads
            } else {
                // Check raw_pdfs
                const rawPdfPath = path.resolve(__dirname, '../../data/raw_pdfs', `${examId}_ans.pdf`);
                // Also try different naming convention if needed (e.g. -Ans.pdf or _ans.pdf)
                // My manual curl saved as FE-2024-Public-AM-Ans.pdf, but examId is FE-2024-Public-AM.
                // So `${examId}-Ans.pdf`
                const rawPdfPath2 = path.resolve(__dirname, '../../data/raw_pdfs', `${examId}-Ans.pdf`);

                if (fs.existsSync(rawPdfPath)) {
                    pdfPath = rawPdfPath;
                } else if (fs.existsSync(rawPdfPath2)) {
                    pdfPath = rawPdfPath2;
                } else if (targetUrl) {
                    console.log(`Downloading Answer PDF for ${examId}...`);
                    try {
                        // @ts-ignore
                        const response = await axios.get(targetUrl, { responseType: 'arraybuffer' });
                        fs.writeFileSync(pdfPath, response.data);
                        console.log(`Saved ${examId}_ans.pdf`);
                    } catch (e: any) {
                        console.error(`Failed to download Answers for ${examId} from ${targetUrl}: ${e.message}`);
                        continue;
                    }
                } else {
                    console.log(`No Answer PDF found for ${examId} (and no URL). Skipping.`);
                    continue;
                }
            }

            // 2. Parse PDF
            const pdfBuffer = fs.readFileSync(pdfPath);
            const pdfData = await pdf(pdfBuffer);
            const text = pdfData.text;

            // 3. Extract Answers (Simple Heuristic)
            // Usually format: "問 1 ア 問 2 イ ..." or table-like structure
            // We will look for "問" followed by numbers

            // Regex to find "問 <number> <kanji/char>" or just number -> char
            // Often PDF text extraction makes it messy: "問 1\nア\n問 2\nイ"
            // Let's print a sample of text to debug if first run, but for now apply generic regex
            // Pattern: 問(\d+)\s+([ア-ンa-zA-Z]) or similar

            // Strategy: Look for sequences of Number followed strictly by [アイウエ]
            // IPA answers are usually Katakana ア, イ, ウ, エ (a, b, c, d)
            // Mapping: ア->a, イ->b, ウ->c, エ->d

            // Map Kana to IDs
            const mapKanaToId: Record<string, string> = {
                'ア': 'a', 'イ': 'b', 'ウ': 'c', 'エ': 'd',
                'オ': 'e', 'カ': 'f', 'キ': 'g', 'ク': 'h', 'ケ': 'i', 'コ': 'j',
                'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd',
                'e': 'e', 'f': 'f', 'g': 'g', 'h': 'h'
            };

            const answerMap: Record<number, string> = {};

            // 2. Parse Text
            const lines = text.split('\n');
            for (const line of lines) {
                // Regex 1: "問5 ア" or "問 5 ア" or "Question 5 a"
                // Expanded to capture more Kana options for FE Subject B
                const regex1 = /(?:問|Q|No\.?)\s*(\d+)\s+([ア-コa-j])/;
                const match = line.match(regex1);
                if (match) {
                    const qNo = parseInt(match[1]);
                    const ansChar = match[2];
                    if (mapKanaToId[ansChar]) {
                        answerMap[qNo] = mapKanaToId[ansChar];
                    }
                }
            }      // Fallback: Sometimes just "1 ア 2 イ" in columns
            if (Object.keys(answerMap).length === 0) {
                // Regex for just "number Space kana"
                const regex2 = /\b(\d{1,2})\s+([アイウエ])/g;
                let match; // Declare match here for the while loop
                while ((match = regex2.exec(text)) !== null) {
                    const qNo = parseInt(match[1]);
                    const ansChar = match[2];
                    if (mapKanaToId[ansChar]) {
                        // Avoid false positives (like year 2025)
                        // Usually QNo is 1-80
                        if (qNo >= 1 && qNo <= 80)
                            answerMap[qNo] = mapKanaToId[ansChar];
                    }
                }
            }

            // 3.5. IP Exam Heuristic (Columnar Layout)
            // If map is empty and it's an IP exam (or we suspect columnar)
            if (Object.keys(answerMap).length < 10) {
                console.log(`Trying Columnar Heuristic for ${examId}...`);
                // Find all "問 <num>"
                const qMatches = [...text.matchAll(/問\s*(\d+)/g)].map(m => ({ q: parseInt(m[1]), idx: m.index || 0 }));
                // Find all Kana lines (excluding headers)
                // Just single kana on a line, potentially surrounded by whitespace
                const aMatches = [...text.matchAll(/^\s*([アイウエ])\s*$/gm)].map(m => ({ a: m[1], idx: m.index || 0 }));

                // MapKana
                const cleanAMatches = aMatches.map(m => ({ ...m, id: mapKanaToId[m.a] }));

                // If counts are close or equal
                // IP usually has 100 questions.
                // Check order.
                // Analyze the first few to see if Q comes before A or A before Q.
                // Or if they are in blocks.
                // Let's assume sequential blocks if counts match.

                if (qMatches.length > 0 && cleanAMatches.length > 0) {
                    // Sort both by index
                    const qs = qMatches.sort((a, b) => a.idx - b.idx);
                    const as = cleanAMatches.sort((a, b) => a.idx - b.idx);

                    console.log(`Heuristic: Found ${qs.length} Qs and ${as.length} As`);

                    // If equal length, Zip?
                    // But wait, debug showed "Ans... Q...".
                    // Let's try to align them. 
                    // If we have Q1...Q100 and A1...A100, we can zip by 'rank'.
                    // Q with rank i maps to A with rank i?
                    // Risk: Missing one Q or A shifts everything.
                    // Constraint: qMatches should be 1,2,3...100?

                    // Let's check if Qs are sequential 1..N
                    const isSequential = qs.every((item, i) => item.q === i + 1);
                    if (isSequential && as.length === qs.length) {
                        console.log("Q sequence is perfect and counts match. Zipping by index.");
                        qs.forEach((item, i) => {
                            answerMap[item.q] = as[i].id;
                        });
                    } else {
                        // Maybe header noise?
                        // Filter Qs to be 1..100?
                        const validQs = qs.filter(x => x.q >= 1 && x.q <= 100);
                        const uniqueQs = Array.from(new Set(validQs.map(x => x.q))).length;

                        if (uniqueQs === validQs.length && as.length >= uniqueQs) {
                            // Assume the first N answers map to these Qs?
                            // This is risky. 
                            // Let's rely on Relative Distance? 
                            // "Nearest Neighbor"?
                            // No, columnar means text is "A1, A2... Q1, Q2..."
                            // Zip by Index is the only logical path if extracted as separate blocks.
                            // Let's try Zipping the first N matches.
                            const limit = Math.min(validQs.length, as.length);
                            for (let i = 0; i < limit; i++) {
                                answerMap[validQs[i].q] = as[i].id;
                            }
                            console.log(`Zipped ${limit} items.`);
                        }
                    }
                }
            }

            console.log(`Found ${Object.keys(answerMap).length} answers for ${examId}.`);

            // 4. Update JSON
            const jsonPath = path.join(dataDir, examId, 'questions_raw.json');
            if (fs.existsSync(jsonPath)) {
                const raw = fs.readFileSync(jsonPath, 'utf-8');
                const questions = JSON.parse(raw);
                let updatedCount = 0;

                // Handle root array or object
                const qList = Array.isArray(questions) ? questions : questions.questions;

                for (const q of qList) {
                    if (answerMap[q.qNo]) {
                        // Only update if missing or if we trust the PDF more?
                        // Update if missing or different (trust PDF)
                        if (q.correctOption !== answerMap[q.qNo]) {
                            q.correctOption = answerMap[q.qNo];
                            updatedCount++;
                        }
                    }
                }

                if (updatedCount > 0) {
                    console.log(`Updated ${updatedCount} questions in ${examId}.`);
                    fs.writeFileSync(jsonPath, JSON.stringify(questions, null, 2));
                } else {
                    console.log(`No updates needed for ${examId}.`);
                }
            } else {
                console.warn(`JSON file not found for ${examId}`);
            }
        } catch (err: any) {
            console.error(`Error processing exam: ${err.message}`);
        }
    }
}

fixAnswers().catch(console.error);
