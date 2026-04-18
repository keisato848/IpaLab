'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAiAssistant } from '@/hooks/use-ai-assistant';
import { appInsights } from '@/components/providers/TelemetryProvider';
import FloatingButton from './FloatingButton';
import AssistantPanel from './AssistantPanel';
import styles from './ai-assistant.module.css';

const EXCLUDED_PATHS = ['/', '/login', '/register'];
const MAX_ERROR_LOGS = 10;

export default function AiAssistantWidget() {
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);

    const {
        panelState,
        messages,
        remainingQuota,
        category,
        currentPage,
        examContext,
        bugReportResult,
        openPanel,
        closePanel,
        goToMenu,
        goToBugForm,
        goToCategory,
        goToChat,
        goToSubmitted,
        addMessage,
        updateLastAssistantMessage,
        setRemainingQuota,
        setExamContext,
    } = useAiAssistant();

    // フィーチャーフラグ確認
    useEffect(() => {
        fetch('/api/feature-flags?id=ai_assistant_enabled')
            .then(res => res.json())
            .then(data => setFeatureEnabled(data.flags?.ai_assistant_enabled ?? false))
            .catch(() => setFeatureEnabled(false));
    }, []);

    // 演習画面のコンテキストをリッスン
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) setExamContext(detail);
        };
        window.addEventListener('ai-assistant-context', handler);
        return () => window.removeEventListener('ai-assistant-context', handler);
    }, [setExamContext]);

    // エラーログ自動収集（window.__errorLogs に最大10件蓄積）
    useEffect(() => {
        const w = window as any;
        if (!w.__errorLogs) w.__errorLogs = [];

        const pushLog = (entry: { message: string; source?: string; timestamp: string }) => {
            const logs = w.__errorLogs as any[];
            logs.push(entry);
            if (logs.length > MAX_ERROR_LOGS) logs.shift();
        };

        const handleError = (e: ErrorEvent) => {
            pushLog({
                message: e.message,
                source: `${e.filename}:${e.lineno}:${e.colno}`,
                timestamp: new Date().toISOString(),
            });
        };

        const handleRejection = (e: PromiseRejectionEvent) => {
            pushLog({
                message: String(e.reason),
                source: 'unhandledrejection',
                timestamp: new Date().toISOString(),
            });
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    // パネル展開時に実際の残回数を取得
    const fetchUsage = useCallback(() => {
        fetch('/api/ai-assistant/usage')
            .then(res => res.json())
            .then(data => {
                if (typeof data.remaining === 'number') {
                    setRemainingQuota(data.remaining);
                }
            })
            .catch(() => { /* フォールバック: 現在値を維持 */ });
    }, [setRemainingQuota]);

    // 未ログイン、除外パス、フィーチャーフラグ無効の場合は表示しない
    if (status !== 'authenticated' || !session) return null;
    if (pathname && EXCLUDED_PATHS.includes(pathname)) return null;
    if (featureEnabled !== true) return null;

    const isOpen = panelState !== 'closed';

    const handleFabClick = () => {
        if (isOpen) {
            closePanel();
        } else {
            openPanel();
            fetchUsage();
            appInsights?.trackEvent({ name: 'ai_assistant_panel_open' });
        }
    };

    return (
        <div data-ai-assistant>
            <FloatingButton isOpen={isOpen} onClick={handleFabClick} />
            {isOpen && (
                <>
                    <div className={styles.overlay} onClick={closePanel} />
                    <AssistantPanel
                    panelState={panelState}
                    messages={messages}
                    remainingQuota={remainingQuota}
                    category={category}
                    currentPage={currentPage}
                    examContext={examContext}
                    bugReportResult={bugReportResult}
                    onClose={closePanel}
                    onGoToMenu={goToMenu}
                    onGoToBugForm={goToBugForm}
                    onGoToCategory={goToCategory}
                    onGoToChat={goToChat}
                    onGoToSubmitted={goToSubmitted}
                    onAddMessage={addMessage}
                    onUpdateLastAssistantMessage={updateLastAssistantMessage}
                    onSetRemainingQuota={setRemainingQuota}
                />
                </>
            )}
        </div>
    );
}
