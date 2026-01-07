import fs from 'fs/promises';
import path from 'path';

// Path to apps/web/data/questions (Copied via prebuild script)
const DATA_DIR = path.join(process.cwd(), 'data/questions');

export interface SSGExamParams {
    year: string;
    type: string;
    examId: string;
}

export interface SSGQuestionParams extends SSGExamParams {
    qNo: string;
}

/**
 * Get all exam IDs from the file system.
 */
export async function getAllExamIdsFS(): Promise<string[]> {
    try {
        const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
        return entries
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            // Filter out hidden dirs and ensure format roughly matches AA-YYYY
            .filter(name => !name.startsWith('.') && /^[A-Z]{2}-\d{4}/.test(name));
    } catch (error) {
        console.error('[SSG] Failed to read data directory:', error);
        return [];
    }
}

/**
 * Get all questions for a specific exam from FS (Transformed > Raw).
 */
export async function getExamDataFS(examId: string): Promise<any[]> {
    const transformedPath = path.join(DATA_DIR, examId, 'questions_transformed.json');
    const rawPath = path.join(DATA_DIR, examId, 'questions_raw.json');

    try {
        let content = '';
        try {
            content = await fs.readFile(transformedPath, 'utf-8');
        } catch {
            content = await fs.readFile(rawPath, 'utf-8');
        }

        const jsonData = JSON.parse(content);

        // Normalize to array
        let questions: any[] = [];
        if (Array.isArray(jsonData)) {
            questions = jsonData;
        } else if (jsonData.questions && Array.isArray(jsonData.questions)) {
            // Fix: Return the inner questions array, not the wrapper object
            questions = jsonData.questions;
        } else {
            questions = [jsonData];
        }

        // Inject examId into each question if missing (Critical for SSG)
        return questions.map(q => ({
            ...q,
            examId: q.examId || examId,
            type: q.type || (examId.includes('AM') ? 'AM' : 'PM') // Fallback type injection
        }));
    } catch (error) {
        console.warn(`[SSG] Data not found for ${examId}:`, error);
        return [];
    }
}

/**
 * Generate all exam params { year, type } for SSG.
 */
export async function generateAllExamParams(): Promise<SSGExamParams[]> {
    const examIds = await getAllExamIdsFS();
    return examIds.map(examId => {
        // Logic to split ID into year/type params compatible with logic in page.tsx
        // page.tsx: const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;
        // So we can largely just pass examId as 'year' and extract 'type'.

        let type = 'PM';
        if (examId.endsWith('-AM')) type = 'AM';
        else if (examId.endsWith('-AM1')) type = 'AM1';
        else if (examId.endsWith('-AM2')) type = 'AM2';
        else if (examId.endsWith('-PM1')) type = 'PM1';
        else if (examId.endsWith('-PM2')) type = 'PM2';

        return {
            year: examId,
            type: type,
            examId: examId
        };
    });
}
