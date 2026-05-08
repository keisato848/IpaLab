import { describe, expect, it, vi } from 'vitest';
import {
    findQuestionByNo,
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

    it('qNo が疎な午後データでも位置番号へフォールバックしない', () => {
        const questions = [
            { id: 'SA-PM1-2', examId: 'SA-2024-Spring-PM1', qNo: 2, text: 'Q2' },
            { id: 'SA-PM1-4', examId: 'SA-2024-Spring-PM1', qNo: 4, text: 'Q4' },
        ] as any;

        expect(findQuestionByNo(questions, 1)).toBeUndefined();
        expect(findQuestionByNo(questions, 3)).toBeUndefined();
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