'use client';

import { useState, useRef, useEffect } from 'react';
import type { Category, ChatMessage as ChatMessageType, ExamContext } from '@/hooks/use-ai-assistant';
import ChatMessage from './ChatMessage';
import { appInsights } from '@/components/providers/TelemetryProvider';
import styles from './ai-assistant.module.css';

interface ChatViewProps {
    messages: ChatMessageType[];
    category: Category;
    examContext: ExamContext | null;
    remainingQuota: number;
    onAddMessage: (msg: ChatMessageType) => void;
    onUpdateLastAssistantMessage: (content: string) => void;
    onSetRemainingQuota: (n: number) => void;
}

export default function ChatView({
    messages,
    category,
    examContext,
    remainingQuota,
    onAddMessage,
    onUpdateLastAssistantMessage,
    onSetRemainingQuota,
}: ChatViewProps) {
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 自動スクロール
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const isDisabled = remainingQuota <= 0 || isStreaming;

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isDisabled) return;

        // ユーザーメッセージ追加
        const userMsg: ChatMessageType = {
            id: crypto.randomUUID(),
            role: 'user',
            content: trimmed,
            timestamp: new Date(),
        };
        onAddMessage(userMsg);
        setInput('');
        setIsStreaming(true);

        // アシスタントメッセージのプレースホルダー
        const assistantMsg: ChatMessageType = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
        };
        onAddMessage(assistantMsg);

        try {
            appInsights?.trackEvent({
                name: 'ai_assistant_chat_request',
                properties: { category },
            });

            const response = await fetch('/api/ai-assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    message: trimmed,
                    context: examContext ?? undefined,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const errorMsg = response.status === 429
                    ? '本日の質問回数上限に達しました。明日またご利用ください。'
                    : response.status === 401
                        ? 'ログインが必要です'
                        : errorBody.error || '回答の生成に失敗しました。しばらく経ってからお試しください。';
                onUpdateLastAssistantMessage(errorMsg);
                if (response.status === 429) {
                    onSetRemainingQuota(0);
                    appInsights?.trackEvent({ name: 'ai_assistant_rate_limit_hit' });
                }
                setIsStreaming(false);
                return;
            }

            // SSE ストリーミング読み取り
            const reader = response.body?.getReader();
            if (!reader) {
                onUpdateLastAssistantMessage('回答の生成に失敗しました。');
                setIsStreaming(false);
                return;
            }

            const decoder = new TextDecoder();
            let accumulated = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.token) {
                            accumulated += data.token;
                            onUpdateLastAssistantMessage(accumulated);
                        }
                        if (data.done) {
                            onSetRemainingQuota(data.remaining);
                        }
                        if (data.error) {
                            onUpdateLastAssistantMessage(
                                accumulated ? accumulated + '\n\n' + data.error : data.error,
                            );
                        }
                    } catch {
                        // JSON パースエラーは無視
                    }
                }
            }
        } catch {
            onUpdateLastAssistantMessage('ネットワークに接続できません。接続を確認してください。');
        } finally {
            setIsStreaming(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles.chatContainer}>
            <div className={styles.chatMessages} role="log" aria-live="polite">
                {messages.length === 0 && (
                    <div className={styles.rateLimitMessage}>
                        質問を入力してください
                    </div>
                )}
                {messages.map((msg) => (
                    <ChatMessage
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        timestamp={msg.timestamp}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles.chatInputArea}>
                {remainingQuota <= 0 ? (
                    <div className={styles.rateLimitMessage}>
                        本日の質問回数上限に達しました。明日またご利用ください。
                    </div>
                ) : (
                    <>
                        <textarea
                            ref={textareaRef}
                            className={styles.chatInput}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="質問を入力..."
                            disabled={isDisabled}
                            rows={1}
                            maxLength={2000}
                        />
                        <button
                            className={styles.sendButton}
                            onClick={handleSend}
                            disabled={isDisabled || !input.trim()}
                            aria-label="メッセージを送信"
                        >
                            {isStreaming ? '...' : '送信'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
