'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './DiagramViewerModal.module.css';

interface DiagramViewerModalProps {
  svgHtml: string;
  onClose: () => void;
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5.0;

export default function DiagramViewerModal({ svgHtml, onClose }: DiagramViewerModalProps) {
  const [scale, setScale] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);
  // ピンチズーム用
  const initialPinchDistance = useRef<number | null>(null);
  const pinchBaseScale = useRef<number>(1.0);

  // モーダル内ではSVGの max-width インラインスタイルを除去して自然なサイズで表示
  const modalSvgHtml = svgHtml.replace(
    /(<svg[^>]*)\bstyle="[^"]*max-width:\s*[^;"]*;?\s*"/,
    '$1'
  );

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + ZOOM_STEP, ZOOM_MAX));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s - ZOOM_STEP, ZOOM_MIN));
  }, []);

  const handleZoomReset = useCallback(() => {
    setScale(1.0);
  }, []);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // オーバーレイクリックで閉じる（コンテンツ領域のクリックは伝播を止める）
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // ピンチズーム用タッチイベント
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      initialPinchDistance.current = getTouchDistance(e.touches);
      pinchBaseScale.current = scale;
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const currentDistance = getTouchDistance(e.touches);
      const ratio = currentDistance / initialPinchDistance.current;
      const newScale = Math.min(Math.max(pinchBaseScale.current * ratio, ZOOM_MIN), ZOOM_MAX);
      setScale(newScale);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    initialPinchDistance.current = null;
  }, []);

  return (
    <div
      className={styles.overlay}
      data-testid="diagram-viewer-overlay"
      onClick={handleOverlayClick}
    >
      <div className={styles.content} data-testid="diagram-viewer-content">
        <div className={styles.toolbar}>
          <button
            className={styles.toolbarButton}
            data-testid="diagram-zoom-in"
            onClick={handleZoomIn}
            aria-label="ズームイン"
          >
            +
          </button>
          <button
            className={styles.toolbarButton}
            data-testid="diagram-zoom-out"
            onClick={handleZoomOut}
            aria-label="ズームアウト"
          >
            −
          </button>
          <button
            className={styles.toolbarButton}
            data-testid="diagram-zoom-reset"
            onClick={handleZoomReset}
            aria-label="ズームリセット"
          >
            1:1
          </button>
          <button
            className={styles.closeButton}
            data-testid="diagram-viewer-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        <div
          className={styles.zoomContainer}
          data-testid="diagram-zoom-container"
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center', transition: 'transform 0.2s ease', width: '100%' }}
            dangerouslySetInnerHTML={{ __html: modalSvgHtml }}
          />
        </div>
      </div>
    </div>
  );
}
