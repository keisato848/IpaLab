// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AIAnswerBox from '@/components/features/exam/AIAnswerBox';

vi.mock('next/dynamic', () => ({
    default: () => () => null,
}));

vi.mock('@/components/ui/Mermaid', () => ({
    default: () => null,
}));

describe('AIAnswerBox', () => {
    it('下書きがある場合は入力欄へ復元する', async () => {
        const draftKey = 'ipalab_pm_answer_draft_v1:test-restore';
        window.localStorage.setItem(draftKey, JSON.stringify({ answer: '保存済み答案', savedAt: '2026-05-06T10:00:00.000Z' }));

        render(<AIAnswerBox questionText="設問" draftKey={draftKey} />);

        await waitFor(() => expect(screen.getByPlaceholderText('ここに回答を入力してください...')).toHaveValue('保存済み答案'));
    });

    it('手動で下書き保存できる', async () => {
        const draftKey = 'ipalab_pm_answer_draft_v1:test-save';
        render(<AIAnswerBox questionText="設問" draftKey={draftKey} />);

        const textarea = screen.getByPlaceholderText('ここに回答を入力してください...');
        fireEvent.change(textarea, { target: { value: '途中答案' } });
        fireEvent.click(screen.getByRole('button', { name: '下書き保存' }));

        await waitFor(() => {
            const draft = JSON.parse(window.localStorage.getItem(draftKey) || '{}');
            expect(draft.answer).toBe('途中答案');
        });
    });

    it('文字数制限を超えると警告を表示し採点できない', () => {
        render(<AIAnswerBox questionText="設問" limit={5} />);

        fireEvent.change(screen.getByPlaceholderText('ここに回答を入力してください...'), { target: { value: '123456' } });

        expect(screen.getByText('6 / 5 文字')).toBeInTheDocument();
        expect(screen.getByText('文字数制限を超えています。制限内に収めてから採点してください。')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'AIで採点する' })).toBeDisabled();
    });

    it('原稿用紙形式で回答を入力できる', () => {
        render(<AIAnswerBox questionText="設問" limit={20} inputVariant="genkoyoshi" />);

        const textarea = screen.getByLabelText('原稿用紙形式の解答入力欄');
        fireEvent.change(textarea, { target: { value: '原稿用紙答案' } });

        expect(screen.getByTestId('genko-counter').textContent).toContain('6');
        expect(screen.queryByPlaceholderText('ここに回答を入力してください...')).not.toBeInTheDocument();
    });
});