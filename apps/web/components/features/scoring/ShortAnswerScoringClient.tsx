'use client';

/**
 * 短答式採点クライアント
 *
 * - 設問IDを指定して原稿用紙UIで解答入力
 * - SSE で観点ごとに逐次描画
 * - design ref: docs/02_design/15_AfternoonScoringAPI_v2.md §2.1
 */

import { useMemo, useState } from 'react';
import type { Scoring } from '@ipa-lab/shared';
type ModelAnswerDiff = Scoring.ModelAnswerDiff;
import { GenkoyoshiInput } from './GenkoyoshiInput';
import { ModelAnswerDiffView } from './ModelAnswerDiffView';
import { PerspectiveCard, PerspectiveCardData } from './PerspectiveCard';
import { useScoringStream } from './useScoringStream';
import styles from './ScoringPage.module.css';

export interface ShortAnswerSampleQuestion {
  questionId: string;
  label: string;
  charLimit: number;
  questionText: string;
  /** 差分ハイライト用（クライアント側 diff フォールバックで使用） */
  modelAnswer?: string;
}

export interface ShortAnswerScoringClientProps {
  samples: ShortAnswerSampleQuestion[];
}

interface CompleteData {
  totalScore?: number;
  maxScore?: number;
  perspectiveScores?: PerspectiveCardData[];
  modelAnswerDiff?: ModelAnswerDiff;
}

export function ShortAnswerScoringClient({ samples }: ShortAnswerScoringClientProps): JSX.Element {
  const [questionId, setQuestionId] = useState(samples[0]?.questionId ?? '');
  const [answer, setAnswer] = useState('');
  const stream = useScoringStream();

  const current = useMemo(
    () => samples.find((s) => s.questionId === questionId) ?? samples[0],
    [samples, questionId],
  );

  const perspectives: PerspectiveCardData[] = stream.events
    .filter((e) => e.event === 'perspective')
    .map((e) => e.data as PerspectiveCardData);
  const errors = stream.events
    .filter((e) => e.event === 'perspective_error')
    .map((e) => e.data as { id: string; message: string });
  const completeEvt = stream.events.find((e) => e.event === 'complete');
  const complete = completeEvt ? (completeEvt.data as CompleteData) : null;

  const submit = () => {
    if (!current || !answer.trim()) return;
    stream.start('/api/ai/scoring/afternoon/short-answer/v2', {
      questionId: current.questionId,
      userAnswer: answer,
      mode: 'stream',
    });
  };

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <span className={styles.seal}>記述式 採点</span>
          <h1 className={styles.title}>午後I 解答採点（系統A）</h1>
          <p className={styles.sub}>原稿用紙形式で解答を入力し、AI採点を受けられます。</p>
        </header>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardLabel}>設問</span>
            {current && <span className={styles.limit}>{current.charLimit}字以内</span>}
          </div>

          <div className={styles.fields}>
            <div>
              <label htmlFor="qid">対象設問</label>
              <select
                id="qid"
                value={questionId}
                onChange={(e) => {
                  setQuestionId(e.target.value);
                  setAnswer('');
                  stream.reset();
                }}
              >
                {samples.map((s) => (
                  <option key={s.questionId} value={s.questionId}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {current && <p style={{ marginBottom: 12, lineHeight: 1.8 }}>{current.questionText}</p>}

          {current && (
            <GenkoyoshiInput
              value={answer}
              onChange={setAnswer}
              maxChars={Math.max(50, Math.ceil(current.charLimit / 10) * 10)}
              placeholder="ここをタップして解答を入力"
              ariaLabel="解答入力"
            />
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.secondary}`}
              onClick={() => {
                setAnswer('');
                stream.reset();
              }}
              disabled={stream.status === 'streaming'}
            >
              クリア
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={submit}
              disabled={!answer.trim() || stream.status === 'streaming'}
              data-testid="submit-button"
            >
              {stream.status === 'streaming' ? '採点中…' : 'AI採点する'}
            </button>
          </div>
        </section>

        {(perspectives.length > 0 || errors.length > 0 || stream.status === 'error') && (
          <section className={styles.results} aria-live="polite">
            <h2 className={styles.resultsTitle}>採点結果</h2>
            {stream.status === 'error' && (
              <div className={styles.errorBox}>採点に失敗しました: {stream.errorMessage}</div>
            )}
            {perspectives.map((p) => (
              <PerspectiveCard key={`p-${p.id}`} data={p} variant="short_answer" />
            ))}
            {errors.map((e) => (
              <PerspectiveCard
                key={`e-${e.id}`}
                data={{ id: e.id, name: e.id, score: 0 }}
                variant="short_answer"
                error={e.message}
              />
            ))}
            {complete && complete.totalScore !== undefined && (
              <div className={styles.summary}>
                <div>
                  <div style={{ fontSize: 11, color: '#857a68' }}>総合スコア</div>
                  <div className={styles.totalScore}>
                    {complete.totalScore}
                    <span style={{ fontSize: 16, color: '#857a68', marginLeft: 4 }}>
                      / {complete.maxScore}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {complete && current?.modelAnswer && (
              <div className={styles.subSection}>
                <h3>模範解答との差分</h3>
                <ModelAnswerDiffView
                  userAnswer={answer}
                  modelAnswer={current.modelAnswer}
                  diff={complete.modelAnswerDiff}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
