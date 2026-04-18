'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ai-assistant.module.css';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
    const timeStr = timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`${styles.message} ${role === 'user' ? styles.messageUser : styles.messageAssistant}`}>
            <div className={`${styles.messageBubble} ${role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                {role === 'user' ? (
                    <p>{content}</p>
                ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm] as any}>
                        {content}
                    </ReactMarkdown>
                )}
            </div>
            <span className={styles.messageTime}>{timeStr}</span>
        </div>
    );
}
