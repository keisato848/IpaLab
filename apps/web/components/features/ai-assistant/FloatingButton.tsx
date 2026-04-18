'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ai-assistant.module.css';

interface FloatingButtonProps {
    isOpen: boolean;
    onClick: () => void;
}

// localStorage キー
const POSITION_STORAGE_KEY = 'ai-assistant-fab-position';
// クリックとドラッグを区別する閾値 (px)
const DRAG_THRESHOLD = 6;
// FAB サイズ（CSS と一致）
const FAB_SIZE = 56;
// 画面端からの最小マージン
const EDGE_MARGIN = 8;

interface Position {
    x: number; // 右端からのオフセット(px)
    y: number; // 下端からのオフセット(px)
}

const DEFAULT_POSITION: Position = { x: 24, y: 24 };

function clampPosition(pos: Position): Position {
    if (typeof window === 'undefined') return pos;
    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - FAB_SIZE - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - FAB_SIZE - EDGE_MARGIN);
    return {
        x: Math.min(Math.max(EDGE_MARGIN, pos.x), maxX),
        y: Math.min(Math.max(EDGE_MARGIN, pos.y), maxY),
    };
}

export default function FloatingButton({ isOpen, onClick }: FloatingButtonProps) {
    const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
    const [isDragging, setIsDragging] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dragStateRef = useRef<{
        startX: number;
        startY: number;
        baseX: number;
        baseY: number;
        moved: boolean;
        pointerId: number;
    } | null>(null);

    // 初期化: localStorage から読み込み
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(POSITION_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
                    setPosition(clampPosition(parsed));
                    return;
                }
            }
        } catch {
            /* 壊れた値は無視 */
        }
        setPosition(clampPosition(DEFAULT_POSITION));
    }, []);

    // ウィンドウリサイズ時に範囲内に収める
    useEffect(() => {
        const handler = () => setPosition(prev => clampPosition(prev));
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    const savePosition = useCallback((pos: Position) => {
        try {
            window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
        } catch {
            /* プライベートモードなどで失敗しても無視 */
        }
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (!buttonRef.current) return;
        if (e.button !== 0) return;
        buttonRef.current.setPointerCapture(e.pointerId);
        dragStateRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            baseX: position.x,
            baseY: position.y,
            moved: false,
            pointerId: e.pointerId,
        };
    }, [position.x, position.y]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const state = dragStateRef.current;
        if (!state || state.pointerId !== e.pointerId) return;

        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;

        if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

        if (!state.moved) {
            state.moved = true;
            setIsDragging(true);
        }

        // right/bottom 基準のため方向を反転
        const newPos = clampPosition({
            x: state.baseX - dx,
            y: state.baseY - dy,
        });
        setPosition(newPos);
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const state = dragStateRef.current;
        if (!state || state.pointerId !== e.pointerId) return;
        dragStateRef.current = null;

        if (buttonRef.current?.hasPointerCapture(e.pointerId)) {
            buttonRef.current.releasePointerCapture(e.pointerId);
        }

        if (state.moved) {
            setIsDragging(false);
            savePosition(position);
        } else {
            // ドラッグせず離した場合はクリック扱い
            onClick();
        }
    }, [onClick, position, savePosition]);

    const handlePointerCancel = useCallback(() => {
        dragStateRef.current = null;
        setIsDragging(false);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);

    return (
        <button
            ref={buttonRef}
            type="button"
            className={`${styles.fab} ${isDragging ? styles.fabDragging : ''}`}
            style={{ right: `${position.x}px`, bottom: `${position.y}px`, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onKeyDown={handleKeyDown}
            aria-label={isOpen ? 'AIアシスタントを閉じる（ドラッグで移動可能）' : 'AIアシスタントを開く（ドラッグで移動可能）'}
        >
            {isOpen ? '✕' : '💬'}
        </button>
    );
}
