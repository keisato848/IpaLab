import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { EXAM_LIST } from './exam-list';

async function downloadExams() {
    console.log("Starting PDF Download...");

    // Ensure raw directory exists
    const rawDir = path.resolve(__dirname, '../../data/raw_pdfs');
    await fs.mkdir(rawDir, { recursive: true });

    for (const exam of EXAM_LIST) {
        // Construct ID: Cat-YYYY-Term-Type (e.g. AP-2023-Fall-AM, PM-2024-Fall-AM2)
        const examId = `${exam.category}-${exam.year}-${exam.term}-${exam.type}`;
        const fileName = `${examId}.pdf`;
        const filePath = path.join(rawDir, fileName);

        // Check availability for Question
        let questionExists = false;
        try {
            await fs.access(filePath);
            console.log(`[SKIP] ${examId} (Question) already exists.`);
            questionExists = true;
        } catch {
            // File does not exist
        }

        if (!questionExists) {
            // Download Question PDF
            console.log(`[DOWNLOAD] ${examId} (Question) from ${exam.url}`);
            try {
                const response = await axios.get(exam.url, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                await fs.writeFile(filePath, response.data);
                console.log(`[SUCCESS] Saved to ${fileName}`);
            } catch (error) {
                console.error(`[ERROR] Failed to download ${examId}:`, error instanceof Error ? error.message : error);
            }
        }

        // Download Answer PDF
        // Pattern: ..._qs.pdf -> ..._ans.pdf
        const answerUrl = exam.url.replace('_qs.pdf', '_ans.pdf');
        const answerFileName = `${examId}-Ans.pdf`;
        const answerFilePath = path.join(rawDir, answerFileName);

        try {
            await fs.access(answerFilePath);
            console.log(`[SKIP] ${examId} (Answer) already exists.`);
        } catch {
            console.log(`[DOWNLOAD] ${examId} (Answer) from ${answerUrl}`);
            try {
                const response = await axios.get(answerUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                await fs.writeFile(answerFilePath, response.data);
                console.log(`[SUCCESS] Saved to ${answerFileName}`);
            } catch (error) {
                // Some exams might not have answers in the exact same pattern (should be rare for recent ones)
                console.warn(`[WARN] Failed to download Answer for ${examId}. URL: ${answerUrl}`);
            }
        }

        // Politeness delay
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("All downloads completed.");
}

if (require.main === module) {
    downloadExams();
}
