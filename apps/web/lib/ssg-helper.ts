import { examRepository } from './repositories/examRepository';
import { questionRepository } from './repositories/questionRepository';

export interface SSGExamParams {
    year: string;
    type: string;
    examId: string;
}

export interface SSGQuestionParams extends SSGExamParams {
    qNo: string;
}

/**
 * Get all exam IDs from DB.
 */
export async function getAllExamIds(): Promise<string[]> {
    try {
        const exams = await examRepository.getAll();
        return exams.map(e => e.id);
    } catch (error) {
        console.error('[DB] Failed to fetch exams:', error);
        return [];
    }
}

/**
 * Get all questions for a specific exam from DB.
 * Replaces getExamDataFS.
 */
export async function getExamData(examId: string): Promise<any[]> {
    try {
        const questions = await questionRepository.listByExamId(examId);
        return questions;
    } catch (error) {
        console.warn(`[DB] Data not found for ${examId}:`, error);
        return [];
    }
}

/**
 * Generate all exam params { year, type } for SSG (or dynamic path resolution).
 */
export async function generateAllExamParams(): Promise<SSGExamParams[]> {
    const exams = await examRepository.getAll();
    return exams.map(exam => {
        return {
            year: exam.id, // Using examId as 'year' param to match existing route logic
            type: exam.type,
            examId: exam.id
        };
    });
}