import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ModelAnswerDiffView } from '@/components/features/scoring/ModelAnswerDiffView';

describe('ModelAnswerDiffView', () => {
  it('初期表示は並列表示で user/model 両方を描画', () => {
    render(<ModelAnswerDiffView userAnswer="多要素認証を導入" modelAnswer="多要素認証と最小権限" />);
    expect(screen.getByRole('heading', { name: 'あなたの解答' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '模範解答' })).toBeTruthy();
  });

  it('不足セグメントに aria-label が付与される', () => {
    render(<ModelAnswerDiffView userAnswer="あい" modelAnswer="あいうえ" />);
    const add = screen.getByLabelText(/不足: うえ/);
    expect(add).toBeTruthy();
    // アイコン（絵文字）は aria-hidden
    expect(add.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('過剰セグメントに aria-label が付与される', () => {
    render(<ModelAnswerDiffView userAnswer="あいうえお" modelAnswer="あいう" />);
    expect(screen.getByLabelText(/過剰: えお/)).toBeTruthy();
  });

  it('差分一覧タブに切替可能', () => {
    render(<ModelAnswerDiffView userAnswer="あい" modelAnswer="あいうえ" />);
    fireEvent.click(screen.getByRole('tab', { name: '差分一覧' }));
    expect(screen.getByText(/不足している表現/)).toBeTruthy();
  });

  it('差分なしの場合は空状態を表示', () => {
    render(<ModelAnswerDiffView userAnswer="同じ" modelAnswer="同じ" />);
    fireEvent.click(screen.getByRole('tab', { name: '差分一覧' }));
    expect(screen.getByRole('status').textContent).toMatch(/差分はありません/);
  });

  it('バックエンド diff 優先: props.diff 指定時はリスト表示でそれを反映', () => {
    render(
      <ModelAnswerDiffView
        userAnswer="ABC"
        modelAnswer="XYZ"
        diff={{
          additions: ['キーワードX'],
          deletions: [],
          rephrasing: [{ user: '旧語', model: '新語' }],
        }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: '差分一覧' }));
    expect(screen.getByText('キーワードX')).toBeTruthy();
    expect(screen.getByText('新語')).toBeTruthy();
  });

  it('tablist / tab / aria-selected が適切', () => {
    render(<ModelAnswerDiffView userAnswer="a" modelAnswer="a" />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    const parallel = screen.getByRole('tab', { name: '並列表示' });
    expect(parallel.getAttribute('aria-selected')).toBe('true');
  });
});
