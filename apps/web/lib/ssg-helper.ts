import fs from 'fs';
import path from 'path';

// Define path to data directory relative to apps/web (CWD during build)
// Structure: root/apps/web -> root/packages/data/data/questions
const DATA_DIR = path.join(process.cwd(), '../../packages/data/data/questions');

export interface SSGExamParams {
    year: string;
    type: string;
    examId: string;
}

export interface SSGQuestionParams extends SSGExamParams {
    qNo: string;
}

/**
 * Get all exam IDs from local filesystem (packages/data).
 */
export async function getAllExamIds(): Promise<string[]> {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            console.warn(`[SSG] Data directory not found: ${DATA_DIR}`);
            return [];
        }
        const dirents = fs.readdirSync(DATA_DIR, { withFileTypes: true });
        return dirents
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    } catch (error) {
        console.error('[SSG] Failed to read exam directories:', error);
        return [];
    }
}

/**
 * Get all questions for a specific exam from local JSON file.
 * Replaces DB access for SSG.
 */
export async function getExamData(examId: string): Promise<any[]> {
    try {
        const filePath = path.join(DATA_DIR, examId, 'questions_raw.json');
        if (!fs.existsSync(filePath)) {
            console.warn(`[SSG] Data file not found for ${examId}: ${filePath}`);
            return [];
        }
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.warn(`[SSG] Error reading data for ${examId}:`, error);
        return [];
    }
}

/**
 * Generate all exam params { year, type } for SSG.
 * Derives metadata from directory names (e.g., "AP-2016-Fall-AM").
 */
export async function generateAllExamParams(): Promise<SSGExamParams[]> {
    const examIds = await getAllExamIds();
    return examIds.map(examId => {
        // directory name format: TYPE-YEAR-...
        // We use the full ID as 'year' to match previous logic where exam.id was passed as year
        // And extract type from the first segment.
        const parts = examId.split('-');
        const type = parts[0] || 'FE'; // Default fallback, though should practically always exist

        return {
            year: examId,
            type: type,
            examId: examId
        };
    });
}