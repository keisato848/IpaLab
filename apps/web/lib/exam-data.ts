import type { Question } from '@/lib/api';
import { getExamData } from '@/lib/ssg-helper';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function resolveQuestionNo(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        const parsed = Number.parseInt(value.trim(), 10);
        return parsed > 0 ? parsed : null;
    }

    return null;
}

export function normalizeExamQuestions(rawData: unknown): Question[] {
    if (Array.isArray(rawData)) {
        return rawData as Question[];
    }

    if (!isRecord(rawData)) {
        return [];
    }

    if (resolveQuestionNo(rawData.qNo) !== null) {
        return [rawData as unknown as Question];
    }

    if (Array.isArray(rawData.questions)) {
        return rawData.questions as Question[];
    }

    return [];
}

export async function loadFilesystemQuestions(examId: string): Promise<Question[]> {
    const fsData = await getExamData(examId);
    return normalizeExamQuestions(fsData);
}

export function findQuestionByNo(questions: Question[], qNo: number): Question | undefined {
    return questions.find(question => resolveQuestionNo(question.qNo) === qNo);
}

export function hasSuspiciousPlaceholderQuestions(examId: string, questions: Question[]): boolean {
    const isAfternoonExam = /-(PM|PM1|PM2)$/.test(examId);
    if (!isAfternoonExam || questions.length === 0) {
        return false;
    }

    const placeholderCount = questions.filter(question => resolveQuestionNo(question.qNo) === 99).length;
    if (placeholderCount === 0) {
        return false;
    }

    const validAfternoonCount = questions.filter(question => {
        const qNo = resolveQuestionNo(question.qNo);
        return qNo !== null && qNo >= 1 && qNo <= 20;
    }).length;

    return validAfternoonCount === 0;
}