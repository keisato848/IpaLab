'use client';

/**
 * Undo/Redo 履歴スタック (#189 DoD: 最大 5 ステップ、Ctrl+Z / Ctrl+Shift+Z)
 *
 * - past:    過去の state（古い順）
 * - present: 現在の state
 * - future:  redo 用の state（新しい順）
 *
 * past は MAX_HISTORY を超えたら先頭から捨てる。
 */

import { useCallback, useEffect, useReducer } from 'react';

export const MAX_HISTORY = 5;

interface State<T> {
    past: T[];
    present: T;
    future: T[];
}

type Action<T> = { type: 'set'; value: T } | { type: 'undo' } | { type: 'redo' } | { type: 'reset'; value: T };

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
    switch (action.type) {
        case 'set': {
            const past = [...state.past, state.present].slice(-MAX_HISTORY);
            return { past, present: action.value, future: [] };
        }
        case 'undo': {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            return {
                past: state.past.slice(0, -1),
                present: previous,
                future: [state.present, ...state.future].slice(0, MAX_HISTORY),
            };
        }
        case 'redo': {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            return {
                past: [...state.past, state.present].slice(-MAX_HISTORY),
                present: next,
                future: state.future.slice(1),
            };
        }
        case 'reset':
            return { past: [], present: action.value, future: [] };
    }
}

export function useUndoRedo<T>(initial: T) {
    const [state, dispatch] = useReducer(reducer<T>, { past: [], present: initial, future: [] });

    const set = useCallback((value: T) => dispatch({ type: 'set', value }), []);
    const undo = useCallback(() => dispatch({ type: 'undo' }), []);
    const redo = useCallback(() => dispatch({ type: 'redo' }), []);
    const reset = useCallback((value: T) => dispatch({ type: 'reset', value }), []);

    // Ctrl+Z / Ctrl+Shift+Z (Mac は Cmd でも動かす)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((key === 'z' && e.shiftKey) || key === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo]);

    return {
        present: state.present,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
        set,
        undo,
        redo,
        reset,
    };
}
