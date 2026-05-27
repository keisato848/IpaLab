'use client';

import { useEffect, useCallback, useRef } from 'react';
import type { PanelState, Category, ChatMessage, ExamContext } from '@/hooks/use-ai-assistant';
import InitialMenu from './InitialMenu';
import BugReportForm from './BugReportForm';
import CategorySelector from './CategorySelector';
import ChatView from './ChatView';
import RateLimitBadge from './RateLimitBadge';
import styles from './ai-assistant.module.css';

interface AssistantPanelProps {
    panelState: PanelState;
    messages: ChatMessage[];
    remainingQuota: number;
    category: Category | null;
    currentPage: 'exam' | 'admin' | 'other';
    examContext: ExamContext | null;
    bugReportResult: { issueNumber: number | null; issueUrl: string | null } | null;
    onClose: () => void;
    onGoToMenu: () => void;
    onGoToBugForm: () => void;
    onGoToCategory: () => void;
    onGoToChat: (category: Category) => void;
    onGoToSubmitted: (result: { issueNumber: number | null; issueUrl: string | null }) => void;
    onAddMessage: (msg: ChatMessage) => void;
    onUpdateLastAssistantMessage: (content: string) => void;
    onSetRemainingQuota: (n: number) => void;
}

export default function AssistantPanel({
    panelState,
    messages,
    remainingQuota,
    category,
    currentPage,
    examContext,
    bugReportResult,
    onClose,
    onGoToMenu,
    onGoToBugForm,
    onGoToCategory,
    onGoToChat,
    onGoToSubmitted,
    onAddMessage,
    onUpdateLastAssistantMessage,
    onSetRemainingQuota,
}: AssistantPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Escape キーでパネルを閉じる + フォーカストラップ
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }

        if (e.key === 'Tab' && panelRef.current) {
            const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length === 0) return;

            const first = focusableElements[0];
            const last = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
    }, [onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // パネル展開時に最初のフォーカス可能要素にフォーカス
    useEffect(() => {
        if (panelRef.current) {
            const firstFocusable = panelRef.current.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            firstFocusable?.focus();
        }
    }, [panelState]);

    const handleQuestion = () => {
        if (currentPage === 'exam') {
            onGoToCategory();
        } else {
            onGoToChat('site-guide');
        }
    };

    const getTitle = () => {
        switch (panelState) {
            case 'bug-form': return '障害報告';
            case 'category': return '質問カテゴリ';
            case 'chat': return 'AIアシスタント';
            case 'submitted': return '報告完了';
            default: return 'AIアシスタント';
        }
    };

    const showBack = panelState !== 'menu' && panelState !== 'closed';

    const handleBack = () => {
        if (panelState === 'chat' && currentPage === 'exam') {
            onGoToCategory();
        } else {
            onGoToMenu();
        }
    };

    return (
        <div
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="AIアシスタント"
        >
            {/* Header */}
            <div className={styles.panelHeader}>
                <div className={styles.panelTitle}>
                    {showBack && (
                        <button
                            type="button"
                            className={styles.backButton}
                            onClick={handleBack}
                            aria-label="戻る"
                        >
                            ←
                        </button>
                    )}
                    {getTitle()}
                </div>
                <div className={styles.headerRight}>
                    {panelState === 'chat' && (
                        <RateLimitBadge remaining={remainingQuota} limit={10} />
                    )}
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="閉じる"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className={styles.panelBody}>
                {panelState === 'menu' && (
                    <InitialMenu
                        currentPage={currentPage}
                        onBugReport={onGoToBugForm}
                        onQuestion={handleQuestion}
                    />
                )}

                {panelState === 'bug-form' && (
                    <BugReportForm
                        onSubmitted={onGoToSubmitted}
                    />
                )}

                {panelState === 'category' && (
                    <CategorySelector
                        examContext={examContext}
                        onSelect={onGoToChat}
                    />
                )}

                {panelState === 'chat' && category && (
                    <ChatView
                        messages={messages}
                        category={category}
                        examContext={examContext}
                        remainingQuota={remainingQuota}
                        onAddMessage={onAddMessage}
                        onUpdateLastAssistantMessage={onUpdateLastAssistantMessage}
                        onSetRemainingQuota={onSetRemainingQuota}
                        onBackToMenu={onGoToMenu}
                    />
                )}

                {panelState === 'submitted' && bugReportResult && (
                    <div className={styles.submittedContainer}>
                        <div className={styles.submittedIcon}>✅</div>
                        <div className={styles.submittedTitle}>報告ありがとうございます</div>
                        <p>内容を受け付けました。運営チームが確認いたします。</p>
                        <button type="button" className={styles.menuButton} onClick={onGoToMenu}>
                            <span className={styles.menuLabel}>メニューに戻る</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
