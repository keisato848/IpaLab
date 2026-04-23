/**
 * StudyPlan 編集の純粋関数 (#189 設計書 ｧ9.1)
 *
 * v1.0 の `replan(input)` は `pinnedRestDays` を直接扱えないため、
 * Phase 1 では「plan を書き換えてから replan に渡す」方式を採用する:
 *   - 休日 ON: 対象日の questionCount を 0 に → debt として未来日へ再配分
 *
 * 元の questionCount は `_baseline` で保持し、OFF 復帰時に元に戻せるようにする。
 * 入力 plan は immutable に扱い、必ず新しいオブジェクトを返す。
 *
 * Note: 集中日 (focus) モードは v2.0 適応型計画の方針 (#217) により廃止。
 * 「特定日に多く解きたい」ニーズは #211 のタスク D&D で代替する。
 */

import type { StudyPlan, DailyTask, WeeklyScheduleItem } from '@/lib/types/studyPlan';

export type EditMode = 'rest' | 'normal';

/** 編集状態（カレンダー上のオーバーレイ）。日付 -> モード */
export type EditState = Record<string, EditMode>;

interface AppliedTask extends DailyTask {
    /** 編集前の元の問題数（roundtrip 用） */
    _baseline?: number;
}

interface AppliedWeek extends WeeklyScheduleItem {
    dailyTasks: AppliedTask[];
}

interface AppliedPlan extends StudyPlan {
    weeklySchedule: AppliedWeek[];
}

/**
 * 編集 state を plan に反映した新しい plan を返す。
 *
 * - mode='rest'   : questionCount = 0
 * - mode='normal' : 何もしない（baseline と同じ）
 *
 * baseline は「呼び出し時点の plan の questionCount」を採用する。
 * したがって本関数は「常に元の plan + 完全な edit state」から呼ぶ前提。
 */
export function applyEditState(plan: StudyPlan, edits: EditState): StudyPlan {
    const next: AppliedPlan = {
        ...plan,
        weeklySchedule: plan.weeklySchedule.map((week) => ({
            ...week,
            dailyTasks: (week.dailyTasks ?? []).map((task) => {
                const mode = edits[task.date] ?? 'normal';
                const baseline = task.questionCount;
                const questionCount = mode === 'rest' ? 0 : baseline;
                return {
                    ...task,
                    questionCount,
                    _baseline: baseline,
                };
            }),
        })),
    };
    return next;
}

/**
 * 単一日のモードを切り替える。
 *
 * UI のクリック1回で normal ⇄ rest をトグル。
 */
export function cycleEditMode(current: EditMode | undefined): EditMode {
    return current === 'rest' ? 'normal' : 'rest';
}

/** 単一日を直接指定モードに設定（明示ボタン用） */
export function setEditMode(state: EditState, date: string, mode: EditMode): EditState {
    if (mode === 'normal') {
        // normal は省略表現
        const next = { ...state };
        delete next[date];
        return next;
    }
    return { ...state, [date]: mode };
}

/** 編集 state を空に戻す */
export function clearEditState(): EditState {
    return {};
}

/**
 * plan 内の全日付（YYYY-MM-DD）を昇順で返す。
 * カレンダー描画・diff 表示で使う。
 */
export function listAllDates(plan: StudyPlan): string[] {
    const dates: string[] = [];
    for (const week of plan.weeklySchedule) {
        for (const task of week.dailyTasks ?? []) {
            dates.push(task.date);
        }
    }
    return dates.sort();
}
