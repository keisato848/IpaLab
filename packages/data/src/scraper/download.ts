import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { AP_EXAM_LIST } from './exam-list';

async function downloadExams() {
    console.log("Starting PDF Download...");

    // Ensure raw directory exists
    const rawDir = path.resolve(__dirname, '../../data/raw_pdfs');
    await fs.mkdir(rawDir, { recursive: true });

    for (const exam of AP_EXAM_LIST) {
        // Construct ID: AP-YYYY-Term-AM (Spring/Fall -> Spring/Fall)
        // Adjust existing ID convention if needed.
        // Existing: AP-2023-Fall-AM
        const examId = `AP-${exam.year}-${exam.term}-AM`;
        const fileName = `${examId}.pdf`;
        const filePath = path.join(rawDir, fileName);

        // Check availability
        try {
            await fs.access(filePath);
            console.log(`[SKIP] ${examId} already exists.`);
            continue;
        } catch {
            // File does not exist, download
        }

        console.log(`[DOWNLOAD] ${examId} from ${exam.url}`);
        try {
            const response = await axios.get(exam.url, {
                responseType: 'arraybuffer',
                timeout: 30000 // 30s timeout
            });
            await fs.writeFile(filePath, response.data);
            console.log(`[SUCCESS] Saved to ${fileName}`);
        } catch (error) {
            console.error(`[ERROR] Failed to download ${examId}:`, error instanceof Error ? error.message : error);
        }

        // Politeness delay
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("All downloads completed.");
}

if (require.main === module) {
    downloadExams();
}
