// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SCPMExamView from '@/components/features/exam/SCPMExamView';

vi.mock('next/dynamic', () => ({
    default: () => () => null,
}));

vi.mock('@/components/features/exam/AIAnswerBox', () => ({
    default: (props: any) => (
        <div
            data-testid="ai-answer-box"
            data-input-variant={props.inputVariant}
            data-limit={props.limit ?? ''}
            data-display-max-chars={props.displayMaxChars ?? ''}
        />
    ),
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

    it('午後の択一選択式はラジオボタンで即時採点する', () => {
        const onChoiceGrade = vi.fn();
        render(<SCPMExamView question={{
            ...question,
            questions: [
                {
                    id: 'q1',
                    subQNo: '1',
                    text: '設問1',
                    subQuestions: [
                        {
                            label: '(1)',
                            text: '適切なものを解答群から選び、記号で答えよ。',
                            answerChoices: ['ア HTTP', 'イ DNS'],
                            answer: 'イ',
                        },
                    ],
                },
            ],
        } as any} onChoiceGrade={onChoiceGrade} />);

        const radio = screen.getByRole('radio', { name: /イ DNS/ });
        fireEvent.click(radio);

        expect(onChoiceGrade).toHaveBeenCalledWith(expect.objectContaining({ answer: 'イ', isCorrect: true }), 0, 0);
        expect(screen.getByText('正解')).toBeInTheDocument();
        expect(screen.queryByTestId('ai-answer-box')).not.toBeInTheDocument();
    });

    it('午後の複数選択式はチェックボックスで採点する', () => {
        const onChoiceGrade = vi.fn();
        render(<SCPMExamView question={{
            ...question,
            questions: [
                {
                    id: 'q1',
                    subQNo: '1',
                    text: '設問1',
                    subQuestions: [
                        {
                            label: '(1)',
                            text: '適切なものを二つ選び、記号で答えよ。',
                            answerChoices: ['ア HTTP', 'イ DNS', 'ウ SMTP'],
                            answer: 'ア, ウ',
                        },
                    ],
                },
            ],
        } as any} onChoiceGrade={onChoiceGrade} />);

        fireEvent.click(screen.getByRole('checkbox', { name: /ア HTTP/ }));
        fireEvent.click(screen.getByRole('checkbox', { name: /ウ SMTP/ }));
        fireEvent.click(screen.getByRole('button', { name: '採点する' }));

        expect(onChoiceGrade).toHaveBeenCalledWith(expect.objectContaining({ answer: 'ア,ウ', isCorrect: true }), 0, 0);
        expect(screen.getByText('正解')).toBeInTheDocument();
    });

    it('PM1の字数制限なし短答は公式解答例の1.2倍程度の原稿用紙にする', () => {
        render(<SCPMExamView question={{
            ...question,
            examId: 'SA-2024-Spring-PM1',
            id: 'SA-2024-Spring-PM1-1',
            subCategory: 'PM1',
            questions: [
                {
                    id: 'q1',
                    subQNo: '設問1',
                    text: '設問1',
                    subQuestions: [
                        {
                            label: '(2)',
                            text: '製造データを作成する際，各工程の想定所要時間はどのように求めるか。時間計算区分が“比例”又は“一定”のそれぞれについて，表1中の属性と，必要に応じて四則演算子を用いて答えよ。',
                            answer: '比例: 所要時間×製造指示数, 一定: 所要時間',
                        },
                    ],
                },
            ],
        } as any} />);

        expect(screen.getByTestId('ai-answer-box')).toHaveAttribute('data-input-variant', 'genkoyoshi');
        expect(screen.getByTestId('ai-answer-box')).toHaveAttribute('data-limit', '');
        expect(screen.getByTestId('ai-answer-box')).toHaveAttribute('data-display-max-chars', '30');
    });

    it('PM1の明示字数制限は原稿用紙入力を維持する', () => {
        render(<SCPMExamView question={{
            ...question,
            subCategory: 'PM1',
            questions: [
                {
                    id: 'q1',
                    subQNo: '設問1',
                    text: '設問1',
                    subQuestions: [
                        { label: '(1)', text: '理由を40字以内で答えよ。', answer: '理由' },
                    ],
                },
            ],
        } as any} />);

        expect(screen.getByTestId('ai-answer-box')).toHaveAttribute('data-input-variant', 'genkoyoshi');
        expect(screen.getByTestId('ai-answer-box')).toHaveAttribute('data-limit', '40');
        expect(screen.getByTestId('ai-answer-box')).toHaveAttribute('data-display-max-chars', '');
    });

    it('PM2論述は字数制限なしでも原稿用紙入力を維持する', () => {
        render(<SCPMExamView question={{
            ...question,
            subCategory: 'PM2',
            questions: [
                {
                    id: 'q1',
                    subQNo: '設問ア',
                    text: '設問ア',
                    answer: '論述例',
                },
            ],
        } as any} />);

        expect(screen.getByTestId('ai-answer-box')).toHaveAttribute('data-input-variant', 'genkoyoshi');
        expect(screen.getByTestId('ai-answer-box')).toHaveAttribute('data-limit', '');
        expect(screen.getByTestId('ai-answer-box')).toHaveAttribute('data-display-max-chars', '');
    });
});