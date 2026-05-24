// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo, MAX_HISTORY } from '@/lib/study-plan/useUndoRedo';

describe('useUndoRedo', () => {
    it('starts with initial value, no undo/redo available', () => {
        const { result } = renderHook(() => useUndoRedo({ a: 1 }));
        expect(result.current.present).toEqual({ a: 1 });
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });

    it('set + undo restores previous', () => {
        const { result } = renderHook(() => useUndoRedo(0));
        act(() => result.current.set(1));
        act(() => result.current.set(2));
        expect(result.current.present).toBe(2);
        act(() => result.current.undo());
        expect(result.current.present).toBe(1);
        act(() => result.current.undo());
        expect(result.current.present).toBe(0);
        expect(result.current.canUndo).toBe(false);
    });

    it('redo restores future after undo', () => {
        const { result } = renderHook(() => useUndoRedo(0));
        act(() => result.current.set(1));
        act(() => result.current.undo());
        expect(result.current.canRedo).toBe(true);
        act(() => result.current.redo());
        expect(result.current.present).toBe(1);
        expect(result.current.canRedo).toBe(false);
    });

    it('caps history at MAX_HISTORY', () => {
        const { result } = renderHook(() => useUndoRedo(0));
        for (let i = 1; i <= MAX_HISTORY + 3; i++) {
            act(() => result.current.set(i));
        }
        // Undo as much as possible -> should not return to 0 (it was overwritten)
        let undoCount = 0;
        while (result.current.canUndo) {
            act(() => result.current.undo());
            undoCount++;
            if (undoCount > MAX_HISTORY + 5) break; // safety
        }
        expect(undoCount).toBeLessThanOrEqual(MAX_HISTORY);
    });

    it('set after undo clears future (redo unavailable)', () => {
        const { result } = renderHook(() => useUndoRedo(0));
        act(() => result.current.set(1));
        act(() => result.current.set(2));
        act(() => result.current.undo());
        act(() => result.current.set(99));
        expect(result.current.canRedo).toBe(false);
        expect(result.current.present).toBe(99);
    });

    it('reset clears history', () => {
        const { result } = renderHook(() => useUndoRedo(0));
        act(() => result.current.set(1));
        act(() => result.current.set(2));
        act(() => result.current.reset(10));
        expect(result.current.present).toBe(10);
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });
});
