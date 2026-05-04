import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { EXAM_LIST } from './exam-list';

const PDF_HEADER = Buffer.from('%PDF-');

function validatePdfProbe(buffer: Buffer, size: number, contentType?: string): string | null {
    const normalizedContentType = (contentType || '').toLowerCase();
    const probeText = buffer.toString('utf8').toLowerCase();

    if (size === 0) {
        return 'empty response';
    }

    if (
        normalizedContentType.includes('text/html') ||
        normalizedContentType.includes('application/xhtml+xml') ||
        normalizedContentType.includes('application/xml') ||
        normalizedContentType.includes('text/xml')
    ) {
        return `unexpected content-type: ${normalizedContentType}`;
    }

    if (
        probeText.includes('<html') ||
        probeText.includes('<!doctype html') ||
        probeText.includes('<?xml')
    ) {
        return 'html/xml content detected';
    }

    if (buffer.length < PDF_HEADER.length || !buffer.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)) {
        return 'missing PDF header';
    }

    return null;
}

async function readFileProbe(filePath: string, probeLength = 512) {
    const handle = await fs.open(filePath, 'r');

    try {
        const stat = await handle.stat();
        const bytesToRead = Math.min(probeLength, stat.size);
        const buffer = Buffer.alloc(bytesToRead);

        if (bytesToRead > 0) {
            await handle.read(buffer, 0, bytesToRead, 0);
        }

        return { buffer, size: stat.size };
    } finally {
        await handle.close();
    }
}

async function hasValidPdf(filePath: string, examId: string, kind: 'Question' | 'Answer') {
    try {
        const { buffer, size } = await readFileProbe(filePath);
        const validationError = validatePdfProbe(buffer, size);

        if (validationError) {
            console.warn(`[INVALID] ${examId} (${kind}) existing file is not a valid PDF: ${validationError}. Re-downloading.`);
            await fs.unlink(filePath);
            return false;
        }

        console.log(`[SKIP] ${examId} (${kind}) already exists.`);
        return true;
    } catch {
        return false;
    }
}

async function downloadPdf(url: string, filePath: string, examId: string, kind: 'Question' | 'Answer') {
    const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 30000
    });
    const buffer = Buffer.from(response.data);
    const validationError = validatePdfProbe(
        buffer.subarray(0, Math.min(buffer.length, 512)),
        buffer.length,
        String(response.headers['content-type'] || '')
    );

    if (validationError) {
        throw new Error(`received non-PDF content for ${examId} (${kind}): ${validationError}`);
    }

    await fs.writeFile(filePath, buffer);
}

async function downloadExams() {
    console.log("Starting PDF Download...");

    // Ensure raw directory exists
    const rawDir = path.resolve(__dirname, '../../data/raw_pdfs');
    await fs.mkdir(rawDir, { recursive: true });

    const categoryFilter = process.env.DOWNLOAD_CATEGORIES
        ? new Set(process.env.DOWNLOAD_CATEGORIES.split(',').map(category => category.trim()).filter(Boolean))
        : null;
    const exams = categoryFilter
        ? EXAM_LIST.filter(exam => categoryFilter.has(exam.category))
        : EXAM_LIST;

    if (categoryFilter) {
        console.log(`[FILTER] Download categories: ${Array.from(categoryFilter).join(', ')}`);
    }

    for (const exam of exams) {
        // Construct ID: Cat-YYYY-Term-Type (e.g. AP-2023-Fall-AM, PM-2024-Fall-AM2)
        const examId = `${exam.category}-${exam.year}-${exam.term}-${exam.type}`;
        const fileName = `${examId}.pdf`;
        const filePath = path.join(rawDir, fileName);

        // Check availability for Question
        const questionExists = await hasValidPdf(filePath, examId, 'Question');

        if (!questionExists) {
            // Download Question PDF
            console.log(`[DOWNLOAD] ${examId} (Question) from ${exam.url}`);
            try {
                await downloadPdf(exam.url, filePath, examId, 'Question');
                console.log(`[SUCCESS] Saved to ${fileName}`);
            } catch (error) {
                console.error(`[ERROR] Failed to download ${examId}:`, error instanceof Error ? error.message : error);
            }
        }

        const answerUrl = 'answerUrl' in exam && exam.answerUrl
            ? exam.answerUrl
            : exam.url.replace('_qs.pdf', '_ans.pdf');
        const answerFileName = `${examId}-Ans.pdf`;
        const answerFilePath = path.join(rawDir, answerFileName);

        const answerExists = await hasValidPdf(answerFilePath, examId, 'Answer');

        if (!answerExists) {
            console.log(`[DOWNLOAD] ${examId} (Answer) from ${answerUrl}`);
            try {
                await downloadPdf(answerUrl, answerFilePath, examId, 'Answer');
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
