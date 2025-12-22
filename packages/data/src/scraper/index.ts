import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { extractAnswersFromPdf } from '../utils/pdf';

// Example: Scrape answers for AP 2023 Fall AM1
// URL to the PDF containing answers (Usually IPA publishes "kaito_pdf" or similar)
// For MVP, we might need a manual mapping of Exam ID to Answer PDF URL
const EXAM_CONFIG = [
    {
        examId: 'AP-2023-Fall-AM',
        url: 'https://www.ipa.go.jp/shiken/mondai-kaiotu/ps6vr70000010d6y-att/2023r05a_ap_am_ans.pdf'
        // Note: URL is hypothetical for demonstration. Real scraper would need exact URLs or discover them.
    }
];

async function main() {
    const rawDir = path.resolve(__dirname, '../../data/raw');
    await fs.mkdir(rawDir, { recursive: true });

    for (const config of EXAM_CONFIG) {
        console.log(`Processing ${config.examId}...`);
        try {
            console.log(`Downloading PDF from ${config.url}`);
            let pdfBuffer: Buffer;

            try {
                const response = await axios.get(config.url, { responseType: 'arraybuffer' });
                pdfBuffer = Buffer.from(response.data);
            } catch (err) {
                console.warn(`Download failed (${err}). Using empty buffer for test.`);
                // Create a minimal valid PDF buffer or just skip extraction to avoid crash
                // For this demo, let's stop here or provide a mock result directly
                const mockAnswers = Array.from({ length: 80 }, (_, i) => ({ qNo: i + 1, correct: ['a', 'b', 'c', 'd'][i % 4] }));

                const output = {
                    examId: config.examId,
                    scrapedAt: new Date().toISOString(),
                    sourceUrl: config.url,
                    answers: mockAnswers,
                    note: "MOCK DATA (Download Failed)"
                };

                const filePath = path.join(rawDir, `${config.examId}_answers.json`);
                await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf-8');
                console.log(`Saved MOCK data to ${filePath}`);
                continue;
            }

            console.log('Extracting text...');
            const answers = await extractAnswersFromPdf(pdfBuffer);

            const output = {
                examId: config.examId,
                scrapedAt: new Date().toISOString(),
                sourceUrl: config.url,
                answers
            };

            const filePath = path.join(rawDir, `${config.examId}_answers.json`);
            await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf-8');
            console.log(`Saved to ${filePath}`);

        } catch (error) {
            console.error(`Failed to process ${config.examId}:`, error);
        }
    }
}

if (require.main === module) {
    main();
}
