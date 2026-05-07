import { describe, expect, it, vi } from 'vitest';
import {
    findQuestionByNo,
    findQuestionByNoOrPosition,
    hasSuspiciousPlaceholderQuestions,
    normalizeExamQuestions,
    resolveQuestionNo,
} from '@/lib/exam-data';

vi.mock('@/lib/ssg-helper', () => ({
    getExamData: vi.fn(),
}));

describe('exam-data', () => {
    it('Form A の配列データを問題配列として返す', () => {
        const questions = [{ id: 'AP-1', examId: 'AP-2024-Spring-AM', qNo: 1, text: 'Q1' }];

        expect(normalizeExamQuestions(questions as any)).toEqual(questions);
    });

    it('Form B の単一問題オブジェクトを配列へ正規化する', () => {
        const question = { id: 'AP-PM-1', examId: 'AP-2017-Spring-PM', qNo: 1, text: 'Q1' };

        expect(normalizeExamQuestions(question as any)).toEqual([question]);
    });

    it('Form C の questions ラッパーを配列へ正規化する', () => {
        const questions = [{ id: 'AP-PM-1', examId: 'AP-2017-Spring-PM', qNo: 1, text: 'Q1' }];

        expect(normalizeExamQuestions({ questions } as any)).toEqual(questions);
    });

    it('数値文字列の qNo でも対象問題を検索できる', () => {
        const questions = [{ id: 'AP-PM-1', examId: 'AP-2017-Spring-PM', qNo: '1', text: 'Q1' }] as any;

        expect(resolveQuestionNo('1')).toBe(1);
        expect(findQuestionByNo(questions, 1)?.id).toBe('AP-PM-1');
    });

    it('qNo が疎な午後データでは位置番号で利用可能な問題へフォールバックする', () => {
        const questions = [
            { id: 'AP-2025-Spring-PM-1', examId: 'AP-2025-Spring-PM', qNo: 1, text: 'Q1' },
            { id: 'AP-2025-Spring-PM-3', examId: 'AP-2025-Spring-PM', qNo: 3, text: 'Q3' },
        ] as any;

        expect(findQuestionByNoOrPosition(questions, 2)?.id).toBe('AP-2025-Spring-PM-3');
        expect(findQuestionByNoOrPosition(questions, 3)?.id).toBe('AP-2025-Spring-PM-3');
    });

    it('午後問題の qNo=99 だけのデータを同期プレースホルダーとして検知する', () => {
        const questions = [{ id: 'AP-2017-Spring-PM-99', examId: 'AP-2017-Spring-PM', qNo: 99, text: 'placeholder' }] as any;

        expect(hasSuspiciousPlaceholderQuestions('AP-2017-Spring-PM', questions)).toBe(true);
    });

    it('午前問題の qNo=99 は正規問題として扱い、プレースホルダー扱いしない', () => {
        const questions = [{ id: 'IP-2024-Public-AM-99', examId: 'IP-2024-Public-AM', qNo: 99, text: 'Q99' }] as any;

        expect(hasSuspiciousPlaceholderQuestions('IP-2024-Public-AM', questions)).toBe(false);
    });

    it('午後問題でも有効な qNo が存在する場合はプレースホルダー扱いしない', () => {
        const questions = [
            { id: 'AP-2017-Spring-PM-1', examId: 'AP-2017-Spring-PM', qNo: 1, text: 'Q1' },
            { id: 'AP-2017-Spring-PM-99', examId: 'AP-2017-Spring-PM', qNo: 99, text: 'old placeholder' },
        ] as any;

        expect(hasSuspiciousPlaceholderQuestions('AP-2017-Spring-PM', questions)).toBe(false);
    });
});