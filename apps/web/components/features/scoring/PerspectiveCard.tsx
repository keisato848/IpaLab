"use client";

/**
 * 観点別スコアカード
 *
 * - SSE で受信した perspective イベントの data をレンダリング
 * - 短答式: matchedKeywords / missingKeywords バッジ
 * - 論述式: subQuestion / evidenceQuotes 表示
 * - デフォルトで詳細を展開表示（学習効率向上のため）
 */

import { useState } from "react";
import styles from "./PerspectiveCard.module.css";

export interface PerspectiveCardData {
  id: string;
  name: string;
  score: number;
  weight?: number;
  rationale?: string;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  evidenceQuotes?: string[];
  subQuestion?: string;
  ruleScore?: number;
  ruleBasedScore?: number;
  llmScore?: number;
  charCount?: number;
  charFlags?: string[];
  tierBreakdown?: Record<string, { matched: number; total: number }>;
  rulePenalties?: string[];
}

export interface PerspectiveCardProps {
  data: PerspectiveCardData;
  variant?: "short_answer" | "essay";
  error?: string | null;
  defaultExpanded?: boolean;
}

export function PerspectiveCard({
  data,
  variant = "short_answer",
  error,
  defaultExpanded = true,
}: PerspectiveCardProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const lowScore = !error && data.score < 60;

  return (
    <div
      className={`${styles.card} ${error ? styles.error : ""} ${lowScore ? styles.weakness : ""}`}
      data-testid={`perspective-card-${data.subQuestion ?? ""}-${data.id}`}
    >
      <button
        type="button"
        className={styles.head}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`${data.name}の詳細を${isExpanded ? "閉じる" : "開く"}`}
      >
        <span className={styles.headMain}>
          {data.subQuestion && (
            <span className={styles.section}>
              <strong>設問{data.subQuestion}</strong>
            </span>
          )}
          <span className={styles.name}>
            {data.name}
            {lowScore && <span className={styles.weaknessBadge}>要改善</span>}
          </span>
          {data.weight !== undefined && (
            <span className={styles.weight}>
              weight {Math.round(data.weight * 100)}%
            </span>
          )}
        </span>
        <span className={styles.headRight}>
          <span
            className={`${styles.score} ${error || lowScore ? styles.low : ""}`}
            aria-label="スコア"
          >
            {Math.round(data.score)}
          </span>
          <span className={styles.expandIcon} aria-hidden="true">
            {isExpanded ? "▼" : "▶"}
          </span>
        </span>
      </button>

      {isExpanded && (
        <div className={styles.details}>
          {error ? (
            <p className={styles.rationale}>採点エラー: {error}</p>
          ) : (
            <p className={styles.rationale}>{data.rationale}</p>
          )}

          {variant === "short_answer" &&
          (data.matchedKeywords?.length || data.missingKeywords?.length) ? (
            <>
              {data.matchedKeywords && data.matchedKeywords.length > 0 && (
                <div className={styles.kw}>
                  <span className={styles.section}>一致:</span>
                  {data.matchedKeywords.map((k) => (
                    <span key={`m-${k}`} className={styles.kwBadge}>
                      {k}
                    </span>
                  ))}
                </div>
              )}
              {data.missingKeywords && data.missingKeywords.length > 0 && (
                <div className={styles.kw}>
                  <span className={styles.section}>不足:</span>
                  {data.missingKeywords.map((k) => (
                    <span
                      key={`x-${k}`}
                      className={`${styles.kwBadge} ${styles.missing}`}
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {variant === "essay" &&
            data.evidenceQuotes &&
            data.evidenceQuotes.length > 0 && (
              <div className={styles.section}>
                <strong>根拠引用:</strong>{" "}
                {data.evidenceQuotes.map((q, i) => (
                  <div key={i} style={{ marginTop: 4, color: "#4a4238" }}>
                    「{q}」
                  </div>
                ))}
              </div>
            )}

          {data.id === "character_count_compliance" &&
            data.ruleScore !== undefined && (
              <div className={styles.section}>
                字数={data.charCount} / ルールスコア={data.ruleScore} / LLM=
                {data.llmScore}
                {data.charFlags && data.charFlags.length > 0
                  ? ` / ${data.charFlags.join(", ")}`
                  : ""}
              </div>
            )}

          {data.id === "keyword_coverage" &&
            (data.ruleBasedScore !== undefined ||
              data.ruleScore !== undefined) && (
              <div className={styles.section}>
                ルール下限={data.ruleBasedScore ?? data.ruleScore} / LLM=
                {data.llmScore}（min を採用）
              </div>
            )}
        </div>
      )}
    </div>
  );
}
