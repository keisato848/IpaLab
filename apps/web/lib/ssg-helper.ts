import fs from 'fs';
import path from 'path';

// Helper to resolve data directory in various environments (local, CI, standalone build)
function resolveDataDir(): string | null {
    const cwd = process.cwd();
    // eslint-disable-next-line no-console
    console.log(`[SSG] Current Working Directory: ${cwd}`);

    // Potential paths to packages/data/data/questions
    // 1. From apps/web root (typical local/CI) -> ../../packages/data...
    // 2. From repo root (if cwd is root) -> packages/data...
    // 3. Fallback for different nesting
    const candidates = [
        path.join(cwd, '../../packages/data/data/questions'),
        path.join(cwd, 'packages/data/data/questions'),
        path.join(cwd, '../packages/data/data/questions'), // Sibling folders?
        path.resolve(cwd, '../../packages/data/data/questions') // Absolute resolve
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            // eslint-disable-next-line no-console
            console.log(`[SSG] Resolved Data Directory: ${candidate}`);
            return candidate;
        }
    }

    console.error(`[SSG] CRITICAL: Could not find data directory. Searched in:`, candidates);
    return null;
}

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
        const dataDir = resolveDataDir();
        if (!dataDir) {
            return [];
        }

        const dirents = fs.readdirSync(dataDir, { withFileTypes: true });
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
        const dataDir = resolveDataDir();
        if (!dataDir) return [];

        const filePath = path.join(dataDir, examId, 'questions_raw.json');
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
        const type = parts[0] || 'FE'; // Default fallback

        return {
            year: examId,
            type: type,
            examId: examId
        };
    });
}