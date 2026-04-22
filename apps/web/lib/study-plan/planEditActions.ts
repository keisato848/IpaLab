/**
 * StudyPlan 編集の純粋関数 (#189 設計書 ｧ9.1)
 *
 * v1.0 の `replan(input)` は `pinnedRestDays` / `pinnedFocusDays` を直接扱えないため、
 * Phase 1 では「plan を書き換えてから replan に渡す」方式を採用する:
 *   - 休日 ON: 対象日の questionCount を 0 に → debt として未来日へ再配分
 *   - 集中日 ON: 対象日の questionCount を round(base * 1.5) に → 吸収枠を拡張
 *
 * 元の questionCount は `restDayBaseline` で保持し、OFF 復帰時に元に戻せるようにする。
 * 入力 plan は immutable に扱い、必ず新しいオブジェクトを返す。
 */

import type { StudyPlan, DailyTask, WeeklyScheduleItem } from '@/lib/types/studyPlan';

export type EditMode = 'rest' | 'focus' | 'normal';

/** 編集状態（カレンダー上のオーバーレイ）。日付 -> モード */
export type EditState = Record<string, EditMode>;

const FOCUS_MULTIPLIER = 1.5;

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
 * - mode='focus'  : questionCount = round(baseline * 1.5)
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
                let questionCount = baseline;
                if (mode === 'rest') {
                    questionCount = 0;
                } else if (mode === 'focus') {
                    questionCount = Math.round(baseline * FOCUS_MULTIPLIER);
                }
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
 * UI のクリック1回で normal -> rest -> focus -> normal とローテーション。
 */
export function cycleEditMode(current: EditMode | undefined): EditMode {
    switch (current) {
        case 'rest':
            return 'focus';
        case 'focus':
            return 'normal';
        case 'normal':
        case undefined:
        default:
            return 'rest';
    }
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
