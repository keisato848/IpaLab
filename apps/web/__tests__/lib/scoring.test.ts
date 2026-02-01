import { describe, it, expect } from 'vitest';
import { calculateExamResult, calculateAggregatedRadar, ExamResult, RadarData } from '@/lib/scoring';
import { Question, LearningRecord } from '@/lib/api';

describe('calculateExamResult', () => {
    const createMockQuestion = (id: string, isPM: boolean, point: number = 100, subQuestions?: any[]): Question => ({
        id,
        qNo: parseInt(id.split('-').pop() || '1'),
        text: 'テスト問題',
        options: { a: '選択肢A', b: '選択肢B', c: '選択肢C', d: '選択肢D' },
        answer: 'a',
        category: 'テスト',
        isPM,
        point,
        subQuestions,
    });

    const createMockRecord = (questionId: string, isCorrect: boolean, aiScore?: number): LearningRecord => ({
        id: `record-${questionId}`,
        examId: 'AP-2024-Fall-PM',
        questionId,
        userId: 'test-user',
        isCorrect,
        answeredAt: new Date().toISOString(),
        isDescriptive: aiScore !== undefined,
        aiScore,
    });

    describe('基本的な計算', () => {
        it('記録がない場合は0点', () => {
            const questions = [createMockQuestion('q1', true, 100)];
            const records: LearningRecord[] = [];
            
            const result = calculateExamResult(records, questions);
            
            expect(result.totalScore).toBe(0);
            expect(result.answeredCount).toBe(0);
        });

        it('PM問題で満点の場合', () => {
            const questions = [createMockQuestion('q1', true, 100)];
            const records = [createMockRecord('q1', true, 100)];
            
            const result = calculateExamResult(records, questions);
            
            expect(result.totalScore).toBe(100);
            expect(result.percentage).toBe(100);
            expect(result.isPassed).toBe(true);
        });

        it('PM問題で60%の場合は合格', () => {
            const questions = [createMockQuestion('q1', true, 100)];
            const records = [createMockRecord('q1', true, 60)];
            
            const result = calculateExamResult(records, questions);
            
            expect(result.percentage).toBe(60);
            expect(result.isPassed).toBe(true);
        });

        it('PM問題で59%の場合は不合格', () => {
            const questions = [createMockQuestion('q1', true, 100)];
            const records = [createMockRecord('q1', true, 59)];
            
            const result = calculateExamResult(records, questions);
            
            expect(result.percentage).toBe(59);
            expect(result.isPassed).toBe(false);
        });
    });

    describe('複数問題の計算', () => {
        it('複数PM問題の加重平均', () => {
            const questions = [
                createMockQuestion('q1', true, 50),
                createMockQuestion('q2', true, 50),
            ];
            const records = [
                createMockRecord('q1', true, 100), // 50点満点で50点
                createMockRecord('q2', true, 60),  // 50点満点で30点
            ];
            
            const result = calculateExamResult(records, questions);
            
            // (100/100 * 50) + (60/100 * 50) = 50 + 30 = 80
            expect(result.totalScore).toBe(80);
            expect(result.totalPoints).toBe(100);
            expect(result.percentage).toBe(80);
        });
    });

    describe('サブ問題の処理', () => {
        it('サブ問題を持つ問題のスコア計算', () => {
            const questions = [
                createMockQuestion('q1', true, 0, [
                    { text: 'サブ問題1', point: 30 },
                    { text: 'サブ問題2', point: 70 },
                ]),
            ];
            const records = [
                createMockRecord('q1-0', true, 80), // 30点満点で24点
                createMockRecord('q1-1', true, 100), // 70点満点で70点
            ];
            
            const result = calculateExamResult(records, questions);
            
            // (80/100 * 30) + (100/100 * 70) = 24 + 70 = 94
            expect(result.totalScore).toBe(94);
            expect(result.totalPoints).toBe(100);
        });
    });

    describe('午前問題の除外', () => {
        it('午前問題（isPM=false）はスコア計算に含まれない', () => {
            const questions = [
                createMockQuestion('am1', false, 0),
                createMockQuestion('pm1', true, 100),
            ];
            const records = [
                createMockRecord('am1', true),
                createMockRecord('pm1', true, 70),
            ];
            
            const result = calculateExamResult(records, questions);
            
            expect(result.totalPoints).toBe(100);
            expect(result.questionCount).toBe(1);
        });
    });
});

describe('calculateAggregatedRadar', () => {
    const createRecordWithRadar = (radarData: { subject: string; A: number }[]): LearningRecord => ({
        id: 'record-1',
        examId: 'AP-2024-PM',
        questionId: 'q1',
        userId: 'test-user',
        isCorrect: true,
        answeredAt: new Date().toISOString(),
        isDescriptive: true,
        aiRadarData: radarData,
    });

    it('レーダーデータがない場合は全て0', () => {
        const records: LearningRecord[] = [];
        const result = calculateAggregatedRadar(records);
        
        result.forEach(data => {
            expect(data.A).toBe(0);
        });
    });

    it('単一レコードのレーダーデータ', () => {
        const records = [
            createRecordWithRadar([
                { subject: '設問適合性', A: 8 },
                { subject: '論理構成', A: 7 },
                { subject: '重要語句', A: 9 },
                { subject: '具体性', A: 6 },
            ]),
        ];
        
        const result = calculateAggregatedRadar(records);
        
        const 設問適合性 = result.find(r => r.subject === '設問適合性');
        expect(設問適合性?.A).toBe(8);
    });

    it('複数レコードの平均値', () => {
        const records = [
            createRecordWithRadar([{ subject: '設問適合性', A: 8 }]),
            createRecordWithRadar([{ subject: '設問適合性', A: 6 }]),
        ];
        
        const result = calculateAggregatedRadar(records);
        
        const 設問適合性 = result.find(r => r.subject === '設問適合性');
        expect(設問適合性?.A).toBe(7); // (8 + 6) / 2 = 7
    });

    it('fullMarkは常に10', () => {
        const records: LearningRecord[] = [];
        const result = calculateAggregatedRadar(records);
        
        result.forEach(data => {
            expect(data.fullMark).toBe(10);
        });
    });
});
