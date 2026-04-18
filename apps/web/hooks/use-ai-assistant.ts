'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export type Category = 'qa-explain' | 'qa-analysis' | 'qa-afternoon' | 'site-guide';
export type PanelState = 'closed' | 'menu' | 'bug-form' | 'category' | 'chat' | 'submitted';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface ExamContext {
    questionId: string;
    questionText: string;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
    isCorrect: boolean;
    examId: string;
    isDescriptive: boolean;
}

export interface AiAssistantState {
    panelState: PanelState;
    messages: ChatMessage[];
    remainingQuota: number;
    category: Category | null;
    currentPage: 'exam' | 'admin' | 'other';
    examContext: ExamContext | null;
    bugReportResult: { issueNumber: number; issueUrl: string } | null;
}

export function useAiAssistant() {
    const pathname = usePathname();
    const currentPage: 'exam' | 'admin' | 'other' =
        pathname?.includes('/exam/') ? 'exam' :
        pathname?.startsWith('/admin') ? 'admin' :
        'other';

    const [panelState, setPanelState] = useState<PanelState>('closed');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [remainingQuota, setRemainingQuota] = useState(10);
    const [category, setCategory] = useState<Category | null>(null);
    const [examContext, setExamContext] = useState<ExamContext | null>(null);
    const [bugReportResult, setBugReportResult] = useState<{ issueNumber: number; issueUrl: string } | null>(null);

    // 画面遷移時に会話をリセット（初回レンダリングをスキップ）
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setMessages([]);
        setCategory(null);
        setExamContext(null);
    }, [pathname]);

    const openPanel = useCallback(() => setPanelState('menu'), []);
    const closePanel = useCallback(() => setPanelState('closed'), []);
    const goToMenu = useCallback(() => setPanelState('menu'), []);
    const goToBugForm = useCallback(() => setPanelState('bug-form'), []);
    const goToCategory = useCallback(() => setPanelState('category'), []);

    const goToChat = useCallback((cat: Category) => {
        setCategory(cat);
        setPanelState('chat');
    }, []);

    const goToSubmitted = useCallback((result: { issueNumber: number; issueUrl: string }) => {
        setBugReportResult(result);
        setPanelState('submitted');
    }, []);

    const addMessage = useCallback((msg: ChatMessage) => {
        setMessages(prev => [...prev, msg]);
    }, []);

    const updateLastAssistantMessage = useCallback((content: string) => {
        setMessages(prev => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === 'assistant') {
                    updated[i] = { ...updated[i], content };
                    break;
                }
            }
            return updated;
        });
    }, []);

    const reset = useCallback(() => {
        setPanelState('closed');
        setMessages([]);
        setCategory(null);
        setBugReportResult(null);
    }, []);

    return {
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
        reset,
    };
}
