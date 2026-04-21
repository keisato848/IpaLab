import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GenkoyoshiInput } from '@/components/features/scoring/GenkoyoshiInput';

describe('GenkoyoshiInput', () => {
  it('初期値の文字数を表示する', () => {
    render(<GenkoyoshiInput value="あいう" maxChars={50} onChange={() => {}} />);
    expect(screen.getByTestId('genko-counter').textContent).toContain('3');
  });

  it('maxChars 個のセルを描画する', () => {
    render(<GenkoyoshiInput value="" maxChars={50} onChange={() => {}} />);
    expect(screen.getAllByTestId(/^genko-cell-/)).toHaveLength(50);
  });

  it('入力で onChange が呼ばれる', () => {
    const onChange = vi.fn();
    render(<GenkoyoshiInput value="" maxChars={20} onChange={onChange} />);
    const ta = screen.getByLabelText('解答入力欄') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'テスト' } });
    expect(onChange).toHaveBeenCalledWith('テスト');
  });

  it('上限超過時に overflow セルが追加表示される', () => {
    render(<GenkoyoshiInput value={'あ'.repeat(15)} maxChars={10} onChange={() => {}} />);
    // 5文字超過
    expect(screen.getAllByTestId(/^genko-overflow-/)).toHaveLength(5);
  });

  it('allowOverflow=false なら超過入力をブロックする', () => {
    const onChange = vi.fn();
    render(
      <GenkoyoshiInput value="あいう" maxChars={3} onChange={onChange} allowOverflow={false} />,
    );
    const ta = screen.getByLabelText('解答入力欄') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'あいうえ' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
