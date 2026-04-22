import { describe, it, expect } from 'vitest';
import {
    EMPTY_EDITOR_STATE,
    setMode,
    setMove,
    clearMove,
    hasAnyEdit,
    manualMovesFromState,
} from '@/lib/study-plan/editorState';

describe('editorState', () => {
    it('setMode: normal なら entry を削除', () => {
        const s1 = setMode(EMPTY_EDITOR_STATE, '2026-04-22', 'rest');
        expect(s1.modes['2026-04-22']).toBe('rest');
        const s2 = setMode(s1, '2026-04-22', 'normal');
        expect(s2.modes['2026-04-22']).toBeUndefined();
    });

    it('setMove: from === to なら clearMove と等価', () => {
        const s1 = setMove(EMPTY_EDITOR_STATE, '2026-04-22', '2026-04-23');
        expect(s1.moves['2026-04-22']).toBe('2026-04-23');
        const s2 = setMove(s1, '2026-04-22', '2026-04-22');
        expect(s2.moves['2026-04-22']).toBeUndefined();
    });

    it('clearMove: 指定 fromDate を消す', () => {
        const s1 = setMove(EMPTY_EDITOR_STATE, '2026-04-22', '2026-04-23');
        const s2 = clearMove(s1, '2026-04-22');
        expect(s2.moves['2026-04-22']).toBeUndefined();
    });

    it('hasAnyEdit: modes か moves に何かあれば true', () => {
        expect(hasAnyEdit(EMPTY_EDITOR_STATE)).toBe(false);
        expect(hasAnyEdit(setMode(EMPTY_EDITOR_STATE, 'd', 'rest'))).toBe(true);
        expect(hasAnyEdit(setMove(EMPTY_EDITOR_STATE, 'a', 'b'))).toBe(true);
    });

    it('manualMovesFromState: { from, to }[] に変換', () => {
        const s = setMove(setMove(EMPTY_EDITOR_STATE, 'a', 'b'), 'c', 'd');
        const moves = manualMovesFromState(s);
        expect(moves).toContainEqual({ fromDate: 'a', toDate: 'b' });
        expect(moves).toContainEqual({ fromDate: 'c', toDate: 'd' });
        expect(moves).toHaveLength(2);
    });

    it('immutability: 元の state は変更されない', () => {
        const s1 = EMPTY_EDITOR_STATE;
        const s2 = setMode(s1, '2026-04-22', 'rest');
        expect(s1.modes['2026-04-22']).toBeUndefined();
        expect(s2).not.toBe(s1);
    });
});
