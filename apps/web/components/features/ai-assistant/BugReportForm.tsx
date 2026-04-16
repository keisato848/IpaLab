'use client';

import { useState } from 'react';
import ScreenshotCapture from './ScreenshotCapture';
import { appInsights } from '@/components/providers/TelemetryProvider';
import styles from './ai-assistant.module.css';

interface BugReportFormProps {
    onSubmitted: (result: { issueNumber: number; issueUrl: string }) => void;
}

export default function BugReportForm({ onSubmitted }: BugReportFormProps) {
    const [description, setDescription] = useState('');
    const [screenshot, setScreenshot] = useState<Blob | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isValid = description.length >= 1 && description.length <= 2000;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('description', description);
            formData.append('pageUrl', window.location.href);
            formData.append('userAgent', navigator.userAgent);

            // エラーログの自動収集
            const errorLogs = (window as any).__errorLogs;
            if (Array.isArray(errorLogs) && errorLogs.length > 0) {
                formData.append('errorLogs', JSON.stringify(errorLogs.slice(-10)));
            }

            if (screenshot) {
                formData.append('screenshot', screenshot, 'screenshot.png');
            }

            const res = await fetch('/api/ai-assistant/bug-report', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || '送信に失敗しました');
            }

            const data = await res.json();
            appInsights?.trackEvent({
                name: 'ai_assistant_bug_report',
                properties: { issueNumber: data.issueNumber },
            });
            onSubmitted({ issueNumber: data.issueNumber, issueUrl: data.issueUrl });
        } catch (err: any) {
            setError(err.message || '障害報告の送信に失敗しました。しばらく経ってからお試しください。');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className={styles.bugForm} onSubmit={handleSubmit}>
            {error && <div className={styles.formError}>{error}</div>}

            <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="bug-description">
                    報告内容 <span style={{ color: 'var(--error-text)' }}>*</span>
                </label>
                <textarea
                    id="bug-description"
                    className={styles.formTextarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="発生した問題を詳しく教えてください..."
                    maxLength={2000}
                    required
                />
                <div className={`${styles.charCount} ${description.length > 2000 ? styles.charCountOver : ''}`}>
                    {description.length} / 2000
                </div>
            </div>

            <div className={styles.screenshotSection}>
                <ScreenshotCapture onCapture={setScreenshot} />
            </div>

            <button
                type="submit"
                className={styles.submitButton}
                disabled={!isValid || isSubmitting}
            >
                {isSubmitting ? (
                    <>
                        <span className={styles.spinner}></span>
                        送信中...
                    </>
                ) : (
                    '障害を報告する'
                )}
            </button>
        </form>
    );
}
