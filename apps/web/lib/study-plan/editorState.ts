/**
 * StudyPlan 編集 UI Phase 2 (#211): タスク単位 D&D 移動。
 *
 * Phase 1 (#189) の `EditState` (休 / 通常) に加え、
 * v1.5 では「ある日のタスク全量を別の日に移動」する `moves` を持つ。
 *
 * data shape:
 *   - modes: Record<date, EditMode>          // 休/通常トグル
 *   - moves: Record<fromDate, toDate>        // D&D / 移動ボタン
 *
 * 同じ fromDate に対する複数指示は最後勝ち。toDate は重複可（複数日が同じ日に集まる）。
 */

import type { EditMode, EditState } from '@/lib/study-plan/planEditActions';

export interface EditorState {
    modes: EditState;
    moves: Record<string, string>;
}

export const EMPTY_EDITOR_STATE: EditorState = { modes: {}, moves: {} };

export function setMode(state: EditorState, date: string, mode: EditMode): EditorState {
    const modes = { ...state.modes };
    if (mode === 'normal') delete modes[date];
    else modes[date] = mode;
    return { ...state, modes };
}

export function setMove(state: EditorState, fromDate: string, toDate: string): EditorState {
    if (fromDate === toDate) return clearMove(state, fromDate);
    return { ...state, moves: { ...state.moves, [fromDate]: toDate } };
}

export function clearMove(state: EditorState, fromDate: string): EditorState {
    const moves = { ...state.moves };
    delete moves[fromDate];
    return { ...state, moves };
}

export function hasAnyEdit(state: EditorState): boolean {
    return Object.keys(state.modes).length > 0 || Object.keys(state.moves).length > 0;
}

export function manualMovesFromState(state: EditorState): { fromDate: string; toDate: string }[] {
    return Object.entries(state.moves).map(([fromDate, toDate]) => ({ fromDate, toDate }));
}
