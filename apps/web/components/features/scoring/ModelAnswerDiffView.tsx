'use client';

/**
 * 模範解答との差分ハイライト表示
 *
 * 設計書: docs/02_design/18_ModelAnswerDiff_UI.md
 *
 * - 3 カテゴリ (additions / deletions / rephrasing) を描画
 * - アイコン (➕➖🔄) + aria-label で色だけに依存しない
 * - セグメント列を渡せば左右並列ビューを組み立てる
 */

import type { Scoring } from '@ipa-lab/shared';
type ModelAnswerDiff = Scoring.ModelAnswerDiff;
import { useMemo, useState } from 'react';
import { computeCharDiff, type DiffSegment } from '@/lib/scoring/clientDiff';
import styles from './ModelAnswerDiffView.module.css';

export interface ModelAnswerDiffViewProps {
  userAnswer: string;
  modelAnswer: string;
  /** バックエンドが返した diff（あれば優先使用、無ければ summary をローカル算出） */
  diff?: ModelAnswerDiff;
}

type Tab = 'parallel' | 'you' | 'model' | 'list';

export function ModelAnswerDiffView({ userAnswer, modelAnswer, diff }: ModelAnswerDiffViewProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('parallel');

  const segments = useMemo(() => computeCharDiff(userAnswer, modelAnswer), [userAnswer, modelAnswer]);
  const summary: ModelAnswerDiff = useMemo(() => {
    if (diff) return diff;
    return {
      additions: segments.modelSegments.filter((s) => s.type === 'addition').map((s) => s.text),
      deletions: segments.userSegments.filter((s) => s.type === 'deletion').map((s) => s.text),
      rephrasing: [],
    };
  }, [diff, segments]);

  return (
    <div className={styles.root} data-testid="model-answer-diff">
      <div className={styles.tabs} role="tablist" aria-label="差分表示切替">
        <TabButton active={tab === 'parallel'} onClick={() => setTab('parallel')} label="並列表示" />
        <TabButton active={tab === 'you'} onClick={() => setTab('you')} label="あなた" mobileOnly />
        <TabButton active={tab === 'model'} onClick={() => setTab('model')} label="模範解答" mobileOnly />
        <TabButton active={tab === 'list'} onClick={() => setTab('list')} label="差分一覧" />
      </div>

      {(tab === 'parallel' || tab === 'you' || tab === 'model') && (
        <div className={`${styles.panels} ${tab !== 'parallel' ? styles.single : ''}`}>
          {(tab === 'parallel' || tab === 'you') && (
            <section className={styles.panel} aria-labelledby="diff-you-heading">
              <h4 id="diff-you-heading" className={styles.panelHead}>
                あなたの解答
              </h4>
              <p className={styles.text}>
                <SegmentSpans segments={segments.userSegments} side="user" />
              </p>
            </section>
          )}
          {(tab === 'parallel' || tab === 'model') && (
            <section className={styles.panel} aria-labelledby="diff-model-heading">
              <h4 id="diff-model-heading" className={styles.panelHead}>
                模範解答
              </h4>
              <p className={styles.text}>
                <SegmentSpans segments={segments.modelSegments} side="model" />
              </p>
            </section>
          )}
        </div>
      )}

      {tab === 'list' && <DiffList diff={summary} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  mobileOnly,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  mobileOnly?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`${styles.tab} ${active ? styles.active : ''} ${mobileOnly ? styles.mobileOnly : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SegmentSpans({ segments, side }: { segments: DiffSegment[]; side: 'user' | 'model' }): JSX.Element {
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === 'match') return <span key={i}>{s.text}</span>;
        if (s.type === 'deletion') {
          return (
            <mark
              key={i}
              className={`${styles.seg} ${styles.deletion}`}
              aria-label={`過剰: ${s.text}`}
              data-testid={`diff-${side}-deletion-${i}`}
            >
              <span aria-hidden="true" className={styles.icon}>
                ➖
              </span>
              {s.text}
            </mark>
          );
        }
        return (
          <mark
            key={i}
            className={`${styles.seg} ${styles.addition}`}
            aria-label={`不足: ${s.text}`}
            data-testid={`diff-${side}-addition-${i}`}
          >
            <span aria-hidden="true" className={styles.icon}>
              ➕
            </span>
            {s.text}
          </mark>
        );
      })}
    </>
  );
}

function DiffList({ diff }: { diff: ModelAnswerDiff }): JSX.Element {
  const empty = diff.additions.length === 0 && diff.deletions.length === 0 && diff.rephrasing.length === 0;
  if (empty) {
    return (
      <p className={styles.emptyList} role="status">
        差分はありません（模範解答とほぼ一致しています）
      </p>
    );
  }
  return (
    <dl className={styles.list}>
      {diff.additions.length > 0 && (
        <>
          <dt className={styles.listTerm}>
            <span aria-hidden="true">➕</span> 不足している表現
          </dt>
          <dd>
            <ul className={styles.listItems}>
              {diff.additions.map((t, i) => (
                <li key={`a-${i}`} className={styles.addition} aria-label={`不足: ${t}`}>
                  {t}
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
      {diff.deletions.length > 0 && (
        <>
          <dt className={styles.listTerm}>
            <span aria-hidden="true">➖</span> 過剰な表現
          </dt>
          <dd>
            <ul className={styles.listItems}>
              {diff.deletions.map((t, i) => (
                <li key={`d-${i}`} className={styles.deletion} aria-label={`過剰: ${t}`}>
                  {t}
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
      {diff.rephrasing.length > 0 && (
        <>
          <dt className={styles.listTerm}>
            <span aria-hidden="true">🔄</span> 言い換え候補
          </dt>
          <dd>
            <ul className={styles.listItems}>
              {diff.rephrasing.map((r, i) => (
                <li key={`r-${i}`} className={styles.rephrasing} aria-label={`言い換え: ${r.user} → ${r.model}`}>
                  <s>{r.user}</s> → <strong>{r.model}</strong>
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
    </dl>
  );
}
