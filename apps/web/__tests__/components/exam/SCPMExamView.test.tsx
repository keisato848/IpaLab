import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SCPMExamView from '@/components/features/exam/SCPMExamView';

vi.mock('next/dynamic', () => ({
    default: () => () => null,
}));

vi.mock('@/components/features/exam/AIAnswerBox', () => ({
    default: (props: any) => <div data-testid="ai-answer-box" data-input-variant={props.inputVariant} />,
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
            text: '設問1について、800文字以内で述べよ。',
            answer: 'モデル答案',
            explanation: '### 解説見出し\n\n**重要**な観点です。',
        },
    ],
} as any;

const choiceQuestion = {
    id: 'AP-2025-Spring-PM-1',
    examId: 'AP-2025-Spring-PM',
    category: 'AP',
    subCategory: 'PM',
    context: {
        title: '午後試験ケース本文',
        background: 'システムの状況説明です。',
        diagrams: [],
    },
    questions: [
        {
            id: 'q1',
            subQNo: '1',
            text: '本文中の [ a ] に入れる適切な字句を解答群の中から選び、記号で答えよ。',
            explanation: '解答群から記号を選ぶ小問です。解答は（ア）です。',
        },
    ],
} as any;

const shortTextQuestion = {
    id: 'AP-2025-Spring-PM-1',
    examId: 'AP-2025-Spring-PM',
    category: 'AP',
    subCategory: 'PM',
    context: {
        title: '午後試験ケース本文',
        background: 'システムの状況説明です。',
        diagrams: [],
    },
    questions: [
        {
            id: 'q1',
            subQNo: '1',
            text: '本文中の下線①の調査方法の名称を、片仮名12字以内で答えよ。',
            explanation: '証拠の保全、調査、分析を行う手法は**デジタルフォレンジック**です。',
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

    it('解答群から記号で答える小問はAI採点欄を出さずラジオボタンを表示する', () => {
        render(<SCPMExamView question={choiceQuestion} />);

        expect(screen.queryByTestId('ai-answer-box')).not.toBeInTheDocument();
        expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: '回答を確定' })).toBeDisabled();
    });

    it('本文抜き出し系の短答式はAI採点欄を出さず短答入力を表示する', () => {
        render(<SCPMExamView question={shortTextQuestion} />);

        expect(screen.queryByTestId('ai-answer-box')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /回答/ })).toBeInTheDocument();
        expect(screen.getByText('0/12')).toBeInTheDocument();
    });
});