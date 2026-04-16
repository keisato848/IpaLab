'use client';

import { useState } from 'react';
import styles from './ai-assistant.module.css';

interface ScreenshotCaptureProps {
    onCapture: (blob: Blob | null) => void;
}

export default function ScreenshotCapture({ onCapture }: ScreenshotCaptureProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCapture = async () => {
        setIsCapturing(true);
        setError(null);

        try {
            const { captureWithMasking } = await import('@/lib/ai-assistant/screenshot-masker');
            const blob = await captureWithMasking();
            const url = URL.createObjectURL(blob);
            setPreview(url);
            onCapture(blob);
        } catch (e) {
            setError('スクリーンショットの取得に失敗しました');
            console.error('Screenshot capture failed:', e);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleRemove = () => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setPreview(null);
        onCapture(null);
    };

    if (preview) {
        return (
            <div className={styles.screenshotPreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="スクリーンショット" />
                <button
                    className={styles.removeScreenshot}
                    onClick={handleRemove}
                    aria-label="スクリーンショットを削除"
                    type="button"
                >
                    ✕
                </button>
            </div>
        );
    }

    return (
        <>
            <button
                className={styles.captureButton}
                onClick={handleCapture}
                disabled={isCapturing}
                type="button"
            >
                {isCapturing ? (
                    <>
                        <span className={styles.spinner}></span>
                        キャプチャ中...
                    </>
                ) : (
                    '📸 スクリーンショットを添付'
                )}
            </button>
            {error && <div className={styles.formError}>{error}</div>}
        </>
    );
}
