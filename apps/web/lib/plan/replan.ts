/**
 * 動的再計画エンジン v1.0 (Phase 1 MVP).
 *
 * - 入力: 既存の `StudyPlan` (apps/web/lib/api.ts) + 直近 `DailyProgress` 配列
 * - 振る舞い: 過去日の未消化問題数 (debt) を、`today` 以降の未来日にグリーディに振り分ける
 * - 制約: 1 日あたりの上限 = `max(originalQuestionCount, baseCap) * boost`
 *   （元計画のサイズを大きく超えない範囲で吸収）
 * - 試験日 (`plan.examDate`) を超える日には絶対に積まない（overflowed として返す）
 * - 純粋関数。I/O ゼロ。ゴールデンテスト容易。
 *
 * 設計書: docs/02_design/20_DynamicReplanningEngine.md §13 (Phase 1 MVP)
 * 関連 Issue: #188 (P2-A-2)
 */

import type { StudyPlan } from '@/lib/api';
import type { DailyProgress } from '@ipa-lab/shared';

export interface ReplanOptions {
    /** 1日あたり上限ブースト（元計画 questionCount に乗算）。default 1.5 */
    capacityBoost?: number;
    /** 元計画 questionCount が 0 の日にも積めるベース容量。default 5 */
    baseCapacity?: number;
    /** 過去日の "完了" を判定する際の許容率。actual >= planned * threshold で完了扱い。default 1.0 */
    completionThreshold?: number;
    /** 集計時刻 (テスト固定用)。 */
    now?: () => string;
}

export interface ReplanMove {
    fromDate: string;
    toDate: string;
    questionCount: number;
    reason: 'unfulfilled_carry_forward' | 'capacity_overflow_pushed' | 'manual_move';
}

export interface ReplanOverflow {
    fromDate: string;
    questionCount: number;
    reason: 'no_future_capacity' | 'past_exam_date' | 'manual_move_invalid';
}

export interface ReplanDiff {
    moved: ReplanMove[];
    overflowed: ReplanOverflow[];
    totalDebtQuestions: number;
    redistributedQuestions: number;
    /** v1.5: manualMoves で適用された件数 */
    manualMovesApplied?: number;
}

export interface ReplanResult {
    plan: StudyPlan;
    diff: ReplanDiff;
    warnings: string[];
    generatedAt: string;
    algorithmVersion: '1.0' | '1.5';
}

/**
 * v1.5: ユーザが D&D / 移動ボタンで指示した「タスク単位の移動」。
 * fromDate / toDate はいずれも `today` 以降かつ `examDate` 以前である必要がある。
 * 不正な move は overflowed (reason: 'manual_move_invalid') として返却される。
 */
export interface ManualMove {
    fromDate: string;
    toDate: string;
}

export interface ReplanInput {
    plan: StudyPlan;
    /** 過去日の進捗（DailyProgress[] のうち date < today のものを参照する） */
    dailyProgress: DailyProgress[];
    /** 今日の日付 YYYY-MM-DD (UTC)。 */
    today: string;
    /** v1.5: タスク単位の手動移動指示。空配列または未指定なら v1.0 と同等の挙動 */
    manualMoves?: ManualMove[];
    options?: ReplanOptions;
}

const DEFAULT_OPTS: Required<Omit<ReplanOptions, 'now'>> = {
    capacityBoost: 1.5,
    baseCapacity: 5,
    completionThreshold: 1.0,
};

/**
 * メインエントリ。`plan` を不変として扱い、再配分後の新しい `StudyPlan` を返す。
 */
export function replan(input: ReplanInput): ReplanResult {
    const opts = { ...DEFAULT_OPTS, ...(input.options ?? {}) };
    const now = (input.options?.now ?? (() => new Date().toISOString()))();
    const { plan, dailyProgress, today } = input;
    const manualMoves = input.manualMoves ?? [];

    const progressByDate = new Map<string, DailyProgress>();
    for (const p of dailyProgress) progressByDate.set(p.date, p);

    // --- 1. 過去日 debt を集計 ----------------------------------------------------
    let totalDebt = 0;
    const moved: ReplanMove[] = [];
    const overflowed: ReplanOverflow[] = [];

    type DayRef = { weekIdx: number; taskIdx: number; date: string; planned: number; cap: number };
    const futureDays: DayRef[] = [];
    const pastDebts: { date: string; debt: number }[] = [];

    plan.weeklySchedule.forEach((week, wi) => {
        (week.dailyTasks ?? []).forEach((task, ti) => {
            if (task.date < today) {
                const actual = progressByDate.get(task.date)?.questionCount ?? 0;
                const required = Math.ceil(task.questionCount * opts.completionThreshold);
                const debt = Math.max(0, required - actual);
                if (debt > 0) {
                    totalDebt += debt;
                    pastDebts.push({ date: task.date, debt });
                }
            } else if (task.date <= plan.examDate) {
                const planned = task.questionCount;
                const cap = Math.max(opts.baseCapacity, Math.ceil(planned * opts.capacityBoost));
                futureDays.push({ weekIdx: wi, taskIdx: ti, date: task.date, planned, cap });
            }
        });
    });

    futureDays.sort((a, b) => a.date.localeCompare(b.date));

    // 各 future day の現在割当量
    const assigned = new Map<string, number>();
    for (const d of futureDays) assigned.set(d.date, d.planned);

    // --- 1.5. manualMoves を先に適用 -------------------------------------------
    let manualMovesApplied = 0;
    const futureDateSet = new Set(futureDays.map((d) => d.date));
    for (const mv of manualMoves) {
        const fromValid = futureDateSet.has(mv.fromDate);
        const toValid = futureDateSet.has(mv.toDate);
        if (!fromValid || !toValid || mv.fromDate === mv.toDate) {
            const fromQty = assigned.get(mv.fromDate) ?? 0;
            if (fromQty > 0) {
                overflowed.push({
                    fromDate: mv.fromDate,
                    questionCount: fromQty,
                    reason: 'manual_move_invalid',
                });
            }
            continue;
        }
        const qty = assigned.get(mv.fromDate) ?? 0;
        if (qty <= 0) continue;
        assigned.set(mv.fromDate, 0);
        assigned.set(mv.toDate, (assigned.get(mv.toDate) ?? 0) + qty);
        moved.push({
            fromDate: mv.fromDate,
            toDate: mv.toDate,
            questionCount: qty,
            reason: 'manual_move',
        });
        manualMovesApplied += 1;
    }

    // --- 2. debt をグリーディに未来日へ詰め込む ---------------------------------------
    let remaining = totalDebt;
    for (const debt of pastDebts) {
        let toRedistribute = debt.debt;
        for (const day of futureDays) {
            if (toRedistribute === 0) break;
            const cur = assigned.get(day.date)!;
            const room = day.cap - cur;
            if (room <= 0) continue;
            const take = Math.min(room, toRedistribute);
            assigned.set(day.date, cur + take);
            moved.push({
                fromDate: debt.date,
                toDate: day.date,
                questionCount: take,
                reason: 'unfulfilled_carry_forward',
            });
            toRedistribute -= take;
            remaining -= take;
        }
        if (toRedistribute > 0) {
            overflowed.push({
                fromDate: debt.date,
                questionCount: toRedistribute,
                reason: futureDays.length === 0 ? 'past_exam_date' : 'no_future_capacity',
            });
        }
    }

    // --- 3. 新しい plan を組み立てる ----------------------------------------------
    const newPlan: StudyPlan = {
        ...plan,
        weeklySchedule: plan.weeklySchedule.map((week) => ({
            ...week,
            dailyTasks: (week.dailyTasks ?? []).map((task) => {
                if (task.date < today) return { ...task };
                if (task.date > plan.examDate) return { ...task };
                const newCount = assigned.get(task.date) ?? task.questionCount;
                if (newCount === task.questionCount) return { ...task };
                return { ...task, questionCount: newCount };
            }),
        })),
    };

    // --- 4. warnings -----------------------------------------------------------
    const warnings: string[] = [];
    if (overflowed.length > 0) {
        const sumOver = overflowed.reduce((s, o) => s + o.questionCount, 0);
        warnings.push(
            `試験日までに収まらない問題が ${sumOver} 問あります。学習時間の見直しを検討してください。`,
        );
    }
    if (totalDebt > 0 && futureDays.length === 0) {
        warnings.push('未来日が存在しないため、未消化分を再配分できません。試験日以降のタスクを追加してください。');
    }

    return {
        plan: newPlan,
        diff: {
            moved,
            overflowed,
            totalDebtQuestions: totalDebt,
            redistributedQuestions: totalDebt - remaining,
            manualMovesApplied,
        },
        warnings,
        generatedAt: now,
        algorithmVersion: manualMoves.length > 0 ? '1.5' : '1.0',
    };
}
