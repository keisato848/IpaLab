import { describe, it, expect } from 'vitest';
import { buildPrompt } from '@/lib/ai-assistant/context-builder';
import type { ExamContext } from '@/hooks/use-ai-assistant';

describe('context-builder', () => {
    const baseContext: ExamContext = {
        questionId: 'q-1',
        questionText: 'テスト問題文',
        userAnswer: 'ア',
        correctAnswer: 'イ',
        explanation: 'テスト解説',
        isCorrect: false,
        examId: 'AP-2024-Spring',
        isDescriptive: false,
    };

    describe('buildPrompt', () => {
        it('qa-explain カテゴリのシステムプロンプトを返す', () => {
            const result = buildPrompt('qa-explain', 'なぜイが正解ですか？', baseContext);

            expect(result.systemPrompt).toContain('情報処理技術者試験');
            expect(result.systemPrompt).toContain('解説');
        });

        it('コンテキスト付きでユーザーメッセージに問題情報を含める', () => {
            const result = buildPrompt('qa-explain', 'なぜイが正解ですか？', baseContext);

            expect(result.userMessage).toContain('テスト問題文');
            expect(result.userMessage).toContain('ア');
            expect(result.userMessage).toContain('イ');
            expect(result.userMessage).toContain('不正解');
            expect(result.userMessage).toContain('なぜイが正解ですか？');
        });

        it('正解の場合は「正解」と表示する', () => {
            const correctContext = { ...baseContext, isCorrect: true };
            const result = buildPrompt('qa-explain', 'test', correctContext);

            expect(result.userMessage).toContain('判定: 正解');
        });

        it('site-guide はコンテキストを無視する', () => {
            const result = buildPrompt('site-guide', '使い方を教えて', baseContext);

            expect(result.userMessage).toBe('使い方を教えて');
            expect(result.systemPrompt).toContain('シカクノ');
        });

        it('コンテキストなしの場合はメッセージのみ返す', () => {
            const result = buildPrompt('qa-explain', 'テスト質問');

            expect(result.userMessage).toBe('テスト質問');
        });

        it('qa-afternoon カテゴリのプロンプトを返す', () => {
            const result = buildPrompt('qa-afternoon', 'テスト', baseContext);

            expect(result.systemPrompt).toContain('午後問題');
        });

        it('午後問題の長いコンテキストをトランケートする', () => {
            const longContext: ExamContext = {
                ...baseContext,
                isDescriptive: true,
                questionText: 'A'.repeat(5000),
                userAnswer: 'B'.repeat(2000),
            };

            const result = buildPrompt('qa-afternoon', 'テスト', longContext);

            // トランケートされて省略マークがつく
            expect(result.userMessage.length).toBeLessThan(
                longContext.questionText.length + longContext.userAnswer.length,
            );
        });

        it('全カテゴリのプロンプトが定義されている', () => {
            const categories = ['qa-explain', 'qa-related', 'qa-analysis', 'qa-afternoon', 'site-guide'] as const;

            for (const category of categories) {
                const result = buildPrompt(category, 'test');
                expect(result.systemPrompt).toBeTruthy();
                expect(result.systemPrompt.length).toBeGreaterThan(10);
            }
        });
    });
});
