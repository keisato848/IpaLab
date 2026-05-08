'use client';

/**
 * 原稿用紙風入力コンポーネント
 *
 * - グリッド DOM を maxChars 分描画し、その上に透明な textarea を絶対配置
 *   （IMEを阻害せずモバイル対応）
 * - 1マス1文字でユーザーが字数感覚を視覚化できる
 * - design ref: Downloads/r6_sa_pm1_q2.html (ユーザー提供)
 */

import { useId, useRef, useState } from 'react';
import styles from './GenkoyoshiInput.module.css';

export interface GenkoyoshiInputProps {
  value: string;
  onChange: (next: string) => void;
  /** マス目の数（≧10、10の倍数を推奨） */
  maxChars: number;
  placeholder?: string;
  /** 字数オーバーをUIで許容するか（API側でも別途検査） */
  allowOverflow?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
}

export function GenkoyoshiInput(props: GenkoyoshiInputProps): JSX.Element {
  const {
    value,
    onChange,
    maxChars,
    placeholder = 'タップして入力',
    allowOverflow = true,
    ariaLabel = '解答入力欄',
    disabled = false,
  } = props;

  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  const chars = Array.from(value);
  const charCount = chars.length;
  const overflow = charCount > maxChars;
  const near = !overflow && charCount >= Math.floor(maxChars * 0.9);
  const counterClass = overflow ? styles.over : near ? styles.near : '';

  const cells = Array.from({ length: maxChars }, (_, i) => {
    const ch = chars[i];
    const filled = ch !== undefined;
    return (
      <div
        key={i}
        className={`${styles.cell} ${filled ? styles.filled : ''}`}
        data-testid={`genko-cell-${i}`}
      >
        {ch ?? ''}
      </div>
    );
  });

  // 上限超過分は別行で警告表示
  const overflowChars = overflow ? chars.slice(maxChars) : [];

  return (
    <div className={styles.outer}>
      <div
        ref={wrapRef}
        className={`${styles.wrap} ${focused ? styles.focused : ''} ${disabled ? styles.disabled : ''} ${
          charCount > 0 ? styles.hasContent : ''
        }`}
        onClick={() => {
          if (!disabled) textareaRef.current?.focus();
        }}
      >
        <div className={styles.grid} aria-hidden>
          {cells}
        </div>
        {overflow && allowOverflow && (
          <div className={styles.grid} aria-hidden style={{ marginTop: '-2px', borderTop: 0 }}>
            {overflowChars.map((ch, i) => (
              <div
                key={`o-${i}`}
                className={`${styles.cell} ${styles.overflow}`}
                data-testid={`genko-overflow-${i}`}
              >
                {ch}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 10 - (overflowChars.length % 10 || 10)) }).map(
              (_, i) => (
                <div key={`p-${i}`} className={styles.cell} />
              ),
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          id={id}
          className={styles.overlay}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (!allowOverflow && Array.from(next).length > maxChars) return;
            onChange(next);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={ariaLabel}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        {charCount === 0 && <div className={styles.tapHint}>{placeholder}</div>}
      </div>
      <div
        className={`${styles.counter} ${counterClass}`}
        data-testid="genko-counter"
        role="status"
        aria-live="polite"
      >
        <span>字数</span>
        <span>
          <span className={styles.count}>{charCount}</span> / {maxChars}
        </span>
      </div>
    </div>
  );
}
