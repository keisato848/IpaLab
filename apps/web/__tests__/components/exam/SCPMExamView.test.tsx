import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SCPMExamView from '@/components/features/exam/SCPMExamView';

vi.mock('next/dynamic', () => ({
    default: () => () => null,
}));

vi.mock('@/components/features/exam/AIAnswerBox', () => ({
    default: () => <div data-testid="ai-answer-box" />,
}));

const question = {
    id: 'SA-2025-Spring-PM1-1',
    examId: 'SA-2025-Spring-PM1',
    category: 'SA',
    subCategory: 'PM1',
    context: {
        title: '午後試験ケース本文',
        background: 'プロジェクトの状況説明です。',
        diagrams: [],
    },
    questions: [
        {
            id: 'q1',
            subQNo: '1',
            text: '設問1の本文',
            answer: 'モデル答案',
            explanation: '### 解説見出し\n\n**重要**な観点です。',
        },
    ],
} as any;

describe('SCPMExamView', () => {
    it('問題文左ペインを閉じて再表示できる', () => {
        render(<SCPMExamView question={question} />);

        expect(screen.getByRole('heading', { name: '午後試験ケース本文' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '問題文を隠す' }));

        expect(screen.queryByRole('heading', { name: '午後試験ケース本文' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '問題文を表示' })).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(screen.getByRole('button', { name: '問題文を表示' }));

        expect(screen.getByRole('heading', { name: '午後試験ケース本文' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '問題文を隠す' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('解答例の解説MarkdownをHTMLとして描画する', () => {
        render(<SCPMExamView question={question} />);

        fireEvent.click(screen.getByRole('button', { name: '解答例を表示' }));

        expect(screen.getByRole('heading', { name: '解説見出し' })).toBeInTheDocument();
        expect(screen.getByText('重要')).toBeInTheDocument();
        expect(screen.queryByText(/### 解説見出し/)).not.toBeInTheDocument();
        expect(screen.queryByText(/\*\*重要\*\*/)).not.toBeInTheDocument();
    });

    it('子設問を持つ説明だけの親見出しは解答欄化しない', () => {
        render(<SCPMExamView question={{
            ...question,
            questions: [
                {
                    id: 'q1',
                    subQNo: '1',
                    text: '設問1 A社の製造データの作成について答えよ。',
                    explanation: '親設問の説明',
                    subQuestions: [
                        {
                            label: '(1)',
                            text: 'A社が作成する製造データを20字以内で答えよ。',
                            answer: '製造計画データ',
                        },
                    ],
                },
            ],
        } as any} />);

        expect(screen.getAllByTestId('ai-answer-box')).toHaveLength(1);
        expect(screen.getByText('解答欄 1')).toBeInTheDocument();
    });
});