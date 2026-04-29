"use client";

/**
 * 論述式採点クライアント
 *
 * - 設問IDを指定し、設問ア/イ/ウを罫線テキストエリアで個別入力
 * - SSE で観点ごとに逐次描画、小問単位で sub_question_complete を集約
 * - design ref: docs/02_design/15_AfternoonScoringAPI_v2.md §2.2
 */

import { useState } from "react";
import { FreeformInput } from "./FreeformInput";
import { PerspectiveCard, PerspectiveCardData } from "./PerspectiveCard";
import { useScoringStream } from "./useScoringStream";
import styles from "./ScoringPage.module.css";

export interface EssaySubMeta {
  requirements: string;
  charMin: number;
  charMax: number;
}

export interface EssaySampleQuestion {
  questionId: string;
  label: string;
  examType: "PM" | "SA" | "ST";
  theme: string;
  subQuestions: { A: EssaySubMeta; I: EssaySubMeta; U: EssaySubMeta };
}

export interface EssayScoringClientProps {
  samples: EssaySampleQuestion[];
}

interface CompleteData {
  overallRank?: "A" | "B" | "C" | "D";
  overallScore?: number;
  characterCounts?: { setsumonA: number; setsumonI: number; setsumonU: number };
  subQuestionScores?: { subQuestion: string; score: number }[];
}

interface SubQuestionCompleteData {
  subQuestion: string;
  score: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function estimateSubQuestionScore(
  perspectives: PerspectiveCardData[],
): number | null {
  if (perspectives.length === 0) return null;
  const weightSum = perspectives.reduce((sum, p) => sum + (p.weight ?? 0), 0);
  if (weightSum > 0) {
    return round1(
      perspectives.reduce(
        (sum, p) => sum + (p.score * (p.weight ?? 0)) / weightSum,
        0,
      ),
    );
  }
  return round1(
    perspectives.reduce((sum, p) => sum + p.score, 0) / perspectives.length,
  );
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function EssayScoringClient({
  samples,
}: EssayScoringClientProps): JSX.Element {
  const [questionId, setQuestionId] = useState(samples[0]?.questionId ?? "");
  const [answer, setAnswer] = useState({
    setsumonA: "",
    setsumonI: "",
    setsumonU: "",
  });
  const stream = useScoringStream();

  const current =
    samples.find((s) => s.questionId === questionId) ?? samples[0];

  const perspectives: (PerspectiveCardData & { subQuestion?: string })[] =
    stream.events
      .filter((e) => e.event === "perspective")
      .map((e) => e.data as PerspectiveCardData);
  const errors = stream.events
    .filter((e) => e.event === "perspective_error")
    .map(
      (e) => e.data as { id: string; message: string; subQuestion?: string },
    );
  const subQuestionScores = stream.events
    .filter((e) => e.event === "sub_question_complete")
    .map((e) => e.data as SubQuestionCompleteData);
  const completeEvt = stream.events.find((e) => e.event === "complete");
  const complete = completeEvt ? (completeEvt.data as CompleteData) : null;

  const submit = () => {
    if (!current) return;
    const total =
      Array.from(answer.setsumonA).length +
      Array.from(answer.setsumonI).length +
      Array.from(answer.setsumonU).length;
    if (total === 0) return;
    stream.start("/api/ai/scoring/afternoon/essay/v2", {
      questionId: current.questionId,
      answer,
      mode: "stream",
    });
  };

  const subSections: {
    key: "A" | "I" | "U";
    label: string;
    field: "setsumonA" | "setsumonI" | "setsumonU";
  }[] = [
    { key: "A", label: "ア", field: "setsumonA" },
    { key: "I", label: "イ", field: "setsumonI" },
    { key: "U", label: "ウ", field: "setsumonU" },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <span className={styles.seal}>論述式 採点</span>
          <h1 className={styles.title}>午後II 論文採点（系統B）</h1>
          <p className={styles.sub}>
            設問ア・イ・ウを個別に入力し、AI採点を受けられます。
          </p>
        </header>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardLabel}>テーマ</span>
            {current && (
              <span className={styles.limit}>{current.examType}午後II</span>
            )}
          </div>
          <div className={styles.fields}>
            <div>
              <label htmlFor="essay-qid">対象論文設問</label>
              <select
                id="essay-qid"
                value={questionId}
                onChange={(e) => {
                  setQuestionId(e.target.value);
                  setAnswer({ setsumonA: "", setsumonI: "", setsumonU: "" });
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
          {current && (
            <p style={{ marginBottom: 8, lineHeight: 1.8 }}>{current.theme}</p>
          )}
        </section>

        {current &&
          subSections.map((s) => {
            const meta = current.subQuestions[s.key];
            return (
              <section key={s.key} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardLabel}>設問{s.label}</span>
                  <span className={styles.limit}>
                    {meta.charMin}〜{meta.charMax}字
                  </span>
                </div>
                <p style={{ marginBottom: 8, fontSize: 13, color: "#4a4238" }}>
                  {meta.requirements}
                </p>
                <FreeformInput
                  value={answer[s.field]}
                  onChange={(v) =>
                    setAnswer((prev) => ({ ...prev, [s.field]: v }))
                  }
                  charMin={meta.charMin}
                  charMax={meta.charMax}
                  placeholder={`設問${s.label}の解答をここに入力`}
                  ariaLabel={`設問${s.label}解答`}
                />
              </section>
            );
          })}

        <section className={styles.card}>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.secondary}`}
              onClick={() => {
                setAnswer({ setsumonA: "", setsumonI: "", setsumonU: "" });
                stream.reset();
              }}
              disabled={stream.status === "streaming"}
            >
              クリア
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={submit}
              disabled={stream.status === "streaming"}
              data-testid="essay-submit-button"
            >
              {stream.status === "streaming" ? "採点中…" : "AI採点する"}
            </button>
          </div>
        </section>

        {(perspectives.length > 0 ||
          errors.length > 0 ||
          stream.status === "error") && (
          <section className={styles.results} aria-live="polite">
            <h2 className={styles.resultsTitle}>採点結果</h2>
            {stream.status === "error" && (
              <div className={styles.errorBox}>
                採点に失敗しました: {stream.errorMessage}
              </div>
            )}

            {(["ア", "イ", "ウ"] as const).map((sub) => {
              const subPersps = perspectives.filter(
                (p) => p.subQuestion === sub,
              );
              const subErrs = errors.filter((e) => e.subQuestion === sub);
              if (subPersps.length === 0 && subErrs.length === 0) return null;

              const finalSubScore = complete?.subQuestionScores?.find(
                (s) => s.subQuestion === sub,
              )?.score;
              const streamedSubScore = subQuestionScores.find(
                (s) => s.subQuestion === sub,
              )?.score;
              const officialSubScore = finalSubScore ?? streamedSubScore;
              const displayedSubScore =
                officialSubScore ?? estimateSubQuestionScore(subPersps);
              const isOfficialSubScore = officialSubScore !== undefined;
              const isWeakSection =
                displayedSubScore !== null && displayedSubScore < 60;

              return (
                <div key={sub} className={styles.subSection}>
                  <div className={styles.subSectionHeader}>
                    <h3>設問{sub}</h3>
                    {displayedSubScore !== null && (
                      <div className={styles.subSectionScore}>
                        <span className={styles.subScoreLabel}>
                          {isOfficialSubScore ? "小問スコア" : "暫定スコア"}
                        </span>
                        <span
                          className={`${styles.subScoreValue} ${isWeakSection ? styles.weak : ""}`}
                        >
                          {formatScore(displayedSubScore)}
                        </span>
                        {isWeakSection && (
                          <span className={styles.subWeakBadge}>要改善</span>
                        )}
                      </div>
                    )}
                  </div>
                  {subPersps.map((p) => (
                    <PerspectiveCard
                      key={`p-${sub}-${p.id}`}
                      data={p}
                      variant="essay"
                    />
                  ))}
                  {subErrs.map((e) => (
                    <PerspectiveCard
                      key={`e-${sub}-${e.id}`}
                      data={{
                        id: e.id,
                        name: e.id,
                        score: 0,
                        subQuestion: sub,
                      }}
                      variant="essay"
                      error={e.message}
                    />
                  ))}
                </div>
              );
            })}

            {complete && complete.overallRank && (
              <div className={styles.summary}>
                <div>
                  <div style={{ fontSize: 11, color: "#857a68" }}>
                    総合スコア
                  </div>
                  <div className={styles.totalScore}>
                    {complete.overallScore}
                  </div>
                </div>
                <div
                  className={`${styles.rank} ${styles[complete.overallRank]}`}
                  aria-label="総合ランク"
                >
                  {complete.overallRank}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
