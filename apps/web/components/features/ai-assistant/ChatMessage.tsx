'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
// @ts-ignore
import he from 'he';
import { normalizeMermaidCodeBlocks } from '@/lib/mermaid/sanitize';
import styles from './ai-assistant.module.css';

const Mermaid = dynamic(() => import('@/components/ui/Mermaid'), { ssr: false });

const markdownComponents = {
    code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        if (!inline && match && match[1] === 'mermaid') {
            const chartContent = he.decode(String(children)).replace(/\n$/, '');
            return <Mermaid chart={chartContent} />;
        }
        return <code className={className} {...props}>{children}</code>;
    }
};

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
                    <ReactMarkdown remarkPlugins={[remarkGfm] as any} components={markdownComponents}>
                        {normalizeMermaidCodeBlocks(content)}
                    </ReactMarkdown>
                )}
            </div>
            <span className={styles.messageTime}>{timeStr}</span>
        </div>
    );
}
