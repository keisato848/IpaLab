import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MonthlyGoalEditor from '@/components/features/dashboard/MonthlyGoalEditor';
import type { MonthlyGoal } from '@/components/features/dashboard/GoalSettingWizard';

// CSS Modules モック
vi.mock('@/components/features/dashboard/MonthlyGoalEditor.module.css', () => ({
    default: new Proxy({}, { get: (_, prop) => String(prop) }),
}));

// ------------------------------------------
// テスト用ヘルパー
// ------------------------------------------

function makeGoals(): MonthlyGoal[] {
    return [
        { id: 'g1', label: '問題演習数', type: 'questionCount', targetValue: 200, unit: '問', iconEmoji: '📝' },
        { id: 'g2', label: '正答率', type: 'accuracy', targetValue: 70, unit: '%', iconEmoji: '🎯' },
    ];
}

// ------------------------------------------
// MonthlyGoalEditor コンポーネント テスト
// ------------------------------------------

describe('MonthlyGoalEditor', () => {
    let onSave: ReturnType<typeof vi.fn>;
    let onClose: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onSave = vi.fn();
        onClose = vi.fn();
    });

    describe('初期表示', () => {
        it('ヘッダーが表示される', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText="テスト目標"
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            expect(screen.getByText(/今月の定量目標を設定/)).toBeInTheDocument();
        });

        it('テキスト目標が初期値で表示される', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText="午前試験対策を仕上げる"
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            const input = screen.getByPlaceholderText(/午前試験対策/);
            expect(input).toHaveValue('午前試験対策を仕上げる');
        });

        it('既存の目標が表示される', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            // 数値入力フィールドに目標値が表示される
            const inputs = screen.getAllByRole('spinbutton');
            expect(inputs).toHaveLength(2);
            expect(inputs[0]).toHaveValue(200);
            expect(inputs[1]).toHaveValue(70);
        });

        it('目標が空の場合、デフォルト4つが表示される', () => {
            render(
                <MonthlyGoalEditor
                    goals={[]}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            const inputs = screen.getAllByRole('spinbutton');
            expect(inputs).toHaveLength(4); // 4つのデフォルト目標
        });
    });

    describe('目標の削除', () => {
        it('削除ボタンで目標を除去できる', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            const removeButtons = screen.getAllByText('🗑');
            expect(removeButtons).toHaveLength(2);

            fireEvent.click(removeButtons[0]);

            // 1つ減って1つになる
            const inputs = screen.getAllByRole('spinbutton');
            expect(inputs).toHaveLength(1);
        });
    });

    describe('目標値の編集', () => {
        it('数値入力で目標値を変更できる', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            const inputs = screen.getAllByRole('spinbutton');
            fireEvent.change(inputs[0], { target: { value: '300' } });

            expect(inputs[0]).toHaveValue(300);
        });
    });

    describe('保存', () => {
        it('保存ボタンでonSaveが呼ばれる', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText="テスト"
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            fireEvent.click(screen.getByText('保存'));

            expect(onSave).toHaveBeenCalledTimes(1);
            const [savedGoals, savedText] = onSave.mock.calls[0];
            expect(savedGoals).toHaveLength(2);
            expect(savedText).toBe('テスト');
        });

        it('目標値0のものはフィルタリングされる', () => {
            const goals = [
                ...makeGoals(),
                { id: 'g3', label: '学習日数', type: 'studyDays' as const, targetValue: 0, unit: '日', iconEmoji: '📅' },
            ];

            render(
                <MonthlyGoalEditor
                    goals={goals}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            fireEvent.click(screen.getByText('保存'));

            const [savedGoals] = onSave.mock.calls[0];
            expect(savedGoals).toHaveLength(2); // targetValue=0のg3は除外
        });

        it('テキスト目標を変更して保存できる', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText="古い目標"
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            const input = screen.getByPlaceholderText(/午前試験対策/);
            fireEvent.change(input, { target: { value: '新しい目標' } });
            fireEvent.click(screen.getByText('保存'));

            const [, savedText] = onSave.mock.calls[0];
            expect(savedText).toBe('新しい目標');
        });
    });

    describe('キャンセル / 閉じる', () => {
        it('キャンセルボタンでonCloseが呼ばれる', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            fireEvent.click(screen.getByText('キャンセル'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('×ボタンでonCloseが呼ばれる', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            fireEvent.click(screen.getByText('×'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('オーバーレイクリックでonCloseが呼ばれる', () => {
            const { container } = render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            // overlay は最初の div
            const overlay = container.firstElementChild!;
            fireEvent.click(overlay);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('モーダル内クリックではonCloseが呼ばれない', () => {
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            // モーダルヘッダーをクリック
            fireEvent.click(screen.getByText(/今月の定量目標を設定/));
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('目標の追加', () => {
        it('追加ボタンで目標を追加できる', () => {
            // 2つの目標で開始（最大4つなので追加ボタンが表示される）
            render(
                <MonthlyGoalEditor
                    goals={makeGoals()}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            const addBtn = screen.getByText(/目標を追加/);
            fireEvent.click(addBtn);

            const inputs = screen.getAllByRole('spinbutton');
            expect(inputs).toHaveLength(3);
        });

        it('4つ全て追加すると追加ボタンが消える', () => {
            // 空（デフォルト4つ）から開始 → 追加ボタンは不可
            render(
                <MonthlyGoalEditor
                    goals={[]}
                    monthlyGoalText=""
                    onSave={onSave}
                    onClose={onClose}
                />
            );

            expect(screen.queryByText(/目標を追加/)).not.toBeInTheDocument();
        });
    });
});
