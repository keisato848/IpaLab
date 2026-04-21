/**
 * 日次進捗集計の純粋関数
 *
 * 設計書: docs/02_design/19_DailyProgressAggregation.md
 * 関連 Issue: #187 (P2-A-1)
 *
 * - LearningRecord[] を受け取り、UTC 日付単位で集計する
 * - 計画タスク (plannedCounts) と照合し status を判定
 * - I/O ゼロ・副作用なし → vitest で網羅的にテスト可能
 */

import type { LearningRecord, DailyProgress } from '@ipa-lab/shared';

export interface AggregateDailyProgressInput {
  userId: string;
  records: LearningRecord[];
  /** 計画上の日次目標問題数 (date -> 計画問題数)。未指定の日は status=none/partial 判定の対象外。 */
  plannedCounts?: Record<string, number>;
  /** 集計対象期間 [from, to]（YYYY-MM-DD, UTC, 両端含む）。未指定なら records の最小〜最大日。 */
  from?: string;
  to?: string;
  /** session 数集計用に sessionId のユニーク数を出す。 */
  countSessions?: boolean;
  /** 集計時刻 (テスト固定用)。未指定なら new Date().toISOString()。 */
  now?: () => string;
}

/**
 * UTC で `answeredAt` から `YYYY-MM-DD` を取り出す。
 * - 入力が無効な場合は null を返す（呼び出し側でスキップ）。
 */
export function toDateKey(answeredAt: string): string | null {
  const d = new Date(answeredAt);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 日次進捗を計算する。
 *
 * - 同じ questionId への複数解答は **最新の answeredAt** を採用する（再挑戦の最終結果を正とする）
 *   → これは useMonthlyProgress と整合する仕様
 * - 計画達成判定:
 *   - plannedCount === 0 または未指定 → 解答 0 で `none`、>=1 で `completed`
 *   - questionCount >= plannedCount → `completed`
 *   - 0 < questionCount < plannedCount → `partial`
 *   - questionCount === 0 かつ plannedCount > 0 → `none`
 */
export function aggregateDailyProgress(input: AggregateDailyProgressInput): DailyProgress[] {
  const { userId, records, plannedCounts, from, to, countSessions, now } = input;

  const latestByQ = new Map<string, LearningRecord>();
  for (const r of records) {
    if (r.userId !== userId) continue;
    const prev = latestByQ.get(r.questionId);
    if (!prev || new Date(r.answeredAt).getTime() > new Date(prev.answeredAt).getTime()) {
      latestByQ.set(r.questionId, r);
    }
  }

  type Bucket = {
    questionCount: number;
    correctCount: number;
    totalTimeSeconds: number;
    sessions: Set<string>;
    exam: Map<string, { count: number; correct: number }>;
  };
  const buckets = new Map<string, Bucket>();

  for (const r of latestByQ.values()) {
    const key = toDateKey(r.answeredAt);
    if (!key) continue;
    if (from && key < from) continue;
    if (to && key > to) continue;

    let b = buckets.get(key);
    if (!b) {
      b = {
        questionCount: 0,
        correctCount: 0,
        totalTimeSeconds: 0,
        sessions: new Set(),
        exam: new Map(),
      };
      buckets.set(key, b);
    }
    b.questionCount += 1;
    if (r.isCorrect) b.correctCount += 1;
    b.totalTimeSeconds += r.timeTakenSeconds;
    if (countSessions && r.sessionId) b.sessions.add(r.sessionId);
    const ex = b.exam.get(r.examId) ?? { count: 0, correct: 0 };
    ex.count += 1;
    if (r.isCorrect) ex.correct += 1;
    b.exam.set(r.examId, ex);
  }

  if (plannedCounts) {
    for (const planDate of Object.keys(plannedCounts)) {
      if (from && planDate < from) continue;
      if (to && planDate > to) continue;
      if (!buckets.has(planDate)) {
        buckets.set(planDate, {
          questionCount: 0,
          correctCount: 0,
          totalTimeSeconds: 0,
          sessions: new Set(),
          exam: new Map(),
        });
      }
    }
  }

  const aggregatedAt = (now ?? (() => new Date().toISOString()))();
  const out: DailyProgress[] = [];
  const sortedKeys = Array.from(buckets.keys()).sort();
  for (const date of sortedKeys) {
    const b = buckets.get(date)!;
    const planned = plannedCounts?.[date];
    const status = decideStatus(b.questionCount, planned);
    const accuracy =
      b.questionCount === 0 ? 0 : Math.round((b.correctCount / b.questionCount) * 1000) / 10;

    const examBreakdown: Record<string, { count: number; correct: number }> = {};
    for (const [examId, v] of b.exam.entries()) examBreakdown[examId] = v;

    out.push({
      id: `${userId}-${date}`,
      userId,
      date,
      questionCount: b.questionCount,
      correctCount: b.correctCount,
      accuracy,
      totalTimeSeconds: b.totalTimeSeconds,
      sessionCount: countSessions ? b.sessions.size : 0,
      examBreakdown,
      plannedQuestionCount: planned,
      status,
      aggregatedAt,
    });
  }

  return out;
}

function decideStatus(actual: number, planned: number | undefined): DailyProgress['status'] {
  if (planned === undefined || planned === 0) {
    return actual === 0 ? 'none' : 'completed';
  }
  if (actual === 0) return 'none';
  if (actual >= planned) return 'completed';
  return 'partial';
}

export interface DailyProgressSummary {
  rangeFrom: string;
  rangeTo: string;
  totalQuestionCount: number;
  totalCorrectCount: number;
  accuracy: number;
  studyDays: number;
  completedDays: number;
  partialDays: number;
  noneDays: number;
  totalTimeSeconds: number;
}

export function summarizeDailyProgress(items: DailyProgress[]): DailyProgressSummary {
  if (items.length === 0) {
    return {
      rangeFrom: '',
      rangeTo: '',
      totalQuestionCount: 0,
      totalCorrectCount: 0,
      accuracy: 0,
      studyDays: 0,
      completedDays: 0,
      partialDays: 0,
      noneDays: 0,
      totalTimeSeconds: 0,
    };
  }
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  let q = 0;
  let c = 0;
  let t = 0;
  let studyDays = 0;
  let completed = 0;
  let partial = 0;
  let none = 0;
  for (const it of items) {
    q += it.questionCount;
    c += it.correctCount;
    t += it.totalTimeSeconds;
    if (it.questionCount > 0) studyDays += 1;
    if (it.status === 'completed') completed += 1;
    else if (it.status === 'partial') partial += 1;
    else none += 1;
  }
  return {
    rangeFrom: sorted[0].date,
    rangeTo: sorted[sorted.length - 1].date,
    totalQuestionCount: q,
    totalCorrectCount: c,
    accuracy: q === 0 ? 0 : Math.round((c / q) * 1000) / 10,
    studyDays,
    completedDays: completed,
    partialDays: partial,
    noneDays: none,
    totalTimeSeconds: t,
  };
}
