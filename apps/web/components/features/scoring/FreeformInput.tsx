'use client';

/**
 * 罫線テキストエリア（論述式向け、長文用）
 *
 * - 字数下限/上限を視覚化（範囲内: 緑、未満: グレー、超過: 赤）
 * - design ref: Downloads/r6_sa_pm1_q2.html `.freeform-input`
 */

import { useId } from 'react';
import styles from './FreeformInput.module.css';

export interface FreeformInputProps {
  value: string;
  onChange: (next: string) => void;
  charMin: number;
  charMax: number;
  placeholder?: string;
  ariaLabel?: string;
}

export function FreeformInput(props: FreeformInputProps): JSX.Element {
  const { value, onChange, charMin, charMax, placeholder, ariaLabel = '解答入力欄' } = props;
  const id = useId();
  const charCount = Array.from(value).length;

  let cls = styles.under;
  if (charCount === 0) cls = styles.under;
  else if (charMin > 0 && charCount < Math.floor(charMin / 2)) cls = styles.fatal;
  else if (charMin > 0 && charCount < charMin) cls = styles.under;
  else if (charCount > charMax) cls = styles.over;
  else cls = styles.ok;

  return (
    <div className={styles.wrap}>
      <textarea
        id={id}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        spellCheck={false}
      />
      <div
        className={`${styles.counter} ${cls}`}
        data-testid="freeform-counter"
        role="status"
        aria-live="polite"
      >
        <span>字数</span>
        <span>
          <span className={styles.count}>{charCount}</span> / {charMin}〜{charMax}
        </span>
      </div>
    </div>
  );
}
