import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { EXAM_LIST } from './exam-list';

async function main() {
    // This script downloads PDFs from the URLs in exam-list.ts
    const rawDir = path.resolve(__dirname, '../../data/raw_pdfs');
    await fs.mkdir(rawDir, { recursive: true });

    // Filter for recent FE exams only to save time
    const targetExams = EXAM_LIST.filter(e => e.category === 'FE' && parseInt(e.year) >= 2023);
    console.log(`Targeting ${targetExams.length} FE exams.`);

    for (const exam of targetExams) {
        const examId = `${exam.category}-${exam.year}-${exam.term}-${exam.type}`;
        try {
            console.log(`Downloading PDF from ${exam.url}`);

            // 1. Download Question PDF
            const pdfPath = path.join(rawDir, `${examId}.pdf`);
            const exists = await fs.access(pdfPath).then(() => true).catch(() => false);

            if (!exists) {
                try {
                    const response = await axios.get(exam.url, { responseType: 'arraybuffer' });
                    await fs.writeFile(pdfPath, response.data);
                    console.log(`Saved ${examId}.pdf`);
                } catch (err: any) {
                    console.error(`Failed to download ${examId}: ${err.message}`);
                }
            } else {
                console.log(`Skipping ${examId}.pdf (already exists)`);
            }

            // 2. Download Answer PDF (if available) - Rename to -Ans.pdf for gemini-extract compatibility
            // Although fix-answers.ts handles it separately, having it here is good backup.
            if ((exam as any).answerUrl) {
                const ansPath = path.join(rawDir, `${examId}-Ans.pdf`);
                if (!(await fs.access(ansPath).then(() => true).catch(() => false))) {
                    try {
                        const response = await axios.get((exam as any).answerUrl, { responseType: 'arraybuffer' });
                        await fs.writeFile(ansPath, response.data);
                        console.log(`Saved ${examId}-Ans.pdf`);
                    } catch (err: any) {
                        console.error(`Failed to download Answers for ${examId}: ${err.message}`);
                    }
                }
            }

        } catch (error) {
            console.error(`Failed to process ${examId}:`, error);
        }
    }
}

if (require.main === module) {
    main();
}
