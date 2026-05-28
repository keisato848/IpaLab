
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import rehypeRaw from 'rehype-raw';
import dynamic from 'next/dynamic';
// @ts-ignore
import he from 'he';
import { GenkoyoshiInput } from '@/components/features/scoring/GenkoyoshiInput';
import { normalizeMermaidCodeBlocks } from '@/lib/mermaid/sanitize';
import styles from './AIAnswerBox.module.css';

// Dynamic import for Recharts to reduce initial bundle size
const RechartsScoreRadar = dynamic(
    () => import('recharts').then(mod => {
        const { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } = mod;
        return function ScoreRadarChart({ data }: { data: any[] }) {
            return (
                <ResponsiveContainer width="100%" height={200}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} hide />
                        <Radar
                            name="Score"
                            dataKey="A"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.6}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            );
        };
    }),
    { ssr: false, loading: () => <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading chart...</div> }
);

// Dynamically import Mermaid to avoid SSR issues
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

interface AIAnswerBoxProps {
    questionText: string;
    modelAnswer?: string; // Optional, might be hidden in some modes
    limit?: number;
    displayMaxChars?: number;
    initialAnswer?: string;
    initialResult?: ScoreResult;
    onSave?: (data: { answer: string; result: ScoreResult }) => void;
    draftKey?: string;
    inputVariant?: 'textarea' | 'genkoyoshi';
}

export interface ScoreResult {
    score: number;
    radarChartData: { subject: string; A: number; fullMark: number }[];
    feedback: string;
    mermaidDiagram?: string;
    improvedAnswer?: string;
}

export default function AIAnswerBox({
    questionText,
    modelAnswer,
    limit,
    displayMaxChars,
    initialAnswer = '',
    initialResult,
    onSave,
    draftKey,
    inputVariant = 'textarea',
    hideChart = false
}: AIAnswerBoxProps & { hideChart?: boolean }) {
    const [answer, setAnswer] = useState(initialAnswer);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ScoreResult | null>(initialResult || null);
    const [error, setError] = useState<string | null>(null);
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
    const [draftError, setDraftError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isOverLimit = typeof limit === 'number' && answer.length > limit;
    const useGenkoyoshiInput = inputVariant === 'genkoyoshi';
    const genkoyoshiMaxChars = limit ?? displayMaxChars ?? 800;
    const normalizedFeedback = useMemo(
        () => normalizeMermaidCodeBlocks(result?.feedback || ''),
        [result?.feedback]
    );
    const normalizedImprovedAnswer = useMemo(
        () => normalizeMermaidCodeBlocks(result?.improvedAnswer || ''),
        [result?.improvedAnswer]
    );

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [answer]);

    useEffect(() => {
        setResult(initialResult || null);

        if (!draftKey || typeof window === 'undefined') {
            setAnswer(initialAnswer);
            setDraftSavedAt(null);
            return;
        }

        try {
            const rawDraft = window.localStorage.getItem(draftKey);
            if (!rawDraft) {
                setAnswer(initialAnswer);
                setDraftSavedAt(null);
                return;
            }

            const draft = JSON.parse(rawDraft) as { answer?: string; savedAt?: string };
            setAnswer(typeof draft.answer === 'string' ? draft.answer : initialAnswer);
            setDraftSavedAt(typeof draft.savedAt === 'string' ? draft.savedAt : null);
        } catch {
            setAnswer(initialAnswer);
            setDraftSavedAt(null);
        }
    }, [draftKey, initialAnswer, initialResult]);

    const saveDraft = (value: string) => {
        if (!draftKey || typeof window === 'undefined') return;

        try {
            const savedAt = new Date().toISOString();
            window.localStorage.setItem(draftKey, JSON.stringify({ answer: value, savedAt }));
            setDraftSavedAt(savedAt);
            setDraftError(null);
        } catch {
            setDraftError('下書き保存に失敗しました');
        }
    };

    useEffect(() => {
        if (!draftKey) return;
        const timer = window.setTimeout(() => saveDraft(answer), 500);
        return () => window.clearTimeout(timer);
    }, [answer, draftKey]);

    const handleScore = async () => {
        if (!answer.trim() || isOverLimit) return;
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: questionText,
                    userAnswer: answer,
                    modelAnswer: modelAnswer
                }),
            });

            const data = await response.json();

            if (response.status === 429) {
                const retryAfter = data.retryAfter ?? 60;
                const minutes = Math.ceil(retryAfter / 60);
                throw new Error(
                    `AI採点の利用上限に達しました。約${minutes}分後に再度お試しください。`,
                );
            }

            if (!response.ok) {
                throw new Error(data.error || '採点中にエラーが発生しました');
            }

            setResult(data);
            saveDraft(answer);

            // Notify parent to save persistence
            if (onSave) {
                onSave({ answer, result: data });
            }

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '通信エラーが発生しました';
            console.error(err);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`${styles.container} ${isExpanded ? styles.expanded : ''}`}>
            <button
                type="button"
                className={styles.expandBtn}
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "元のサイズに戻す" : "入力欄を拡大する"}
            >
                {isExpanded ? "⤢ 縮小" : "⤢ 拡大"}
            </button>
            <div className={styles.inputWrapper}>
                {useGenkoyoshiInput ? (
                    <div className={styles.genkoyoshiWrapper} aria-invalid={isOverLimit}>
                        <GenkoyoshiInput
                            value={answer}
                            onChange={setAnswer}
                            maxChars={genkoyoshiMaxChars}
                            placeholder="ここに回答を入力してください"
                            ariaLabel="原稿用紙形式の解答入力欄"
                            disabled={isLoading}
                        />
                    </div>
                ) : (
                    <>
                        <textarea
                            ref={textareaRef}
                            className={styles.textarea}
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="ここに回答を入力してください..."
                            rows={5}
                            disabled={isLoading}
                            aria-invalid={isOverLimit}
                        />
                        <div className={styles.charCounter}>
                            {limit ? (
                                <span className={answer.length > limit ? styles.charOver : ''}>
                                    {answer.length} / {limit} 文字
                                </span>
                            ) : (
                                <span>{answer.length} 文字</span>
                            )}
                        </div>
                    </>
                )}
                {useGenkoyoshiInput && !limit && (
                    <div className={styles.charCounter}>
                        <span>{answer.length} 文字</span>
                    </div>
                )}
                {isOverLimit && (
                    <div className={styles.limitWarning}>文字数制限を超えています。制限内に収めてから採点してください。</div>
                )}
            </div>

            <div className={styles.actions}>
                {draftKey && (
                    <div className={styles.draftArea}>
                        <button
                            type="button"
                            onClick={() => saveDraft(answer)}
                            className={styles.draftBtn}
                            disabled={isLoading}
                        >
                            下書き保存
                        </button>
                        <span className={draftError ? styles.draftError : styles.draftStatus}>
                            {draftError || (draftSavedAt ? `保存済み ${new Date(draftSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : '未保存')}
                        </span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={handleScore}
                    disabled={!answer.trim() || isLoading || isOverLimit}
                    className={styles.scoreBtn}
                >
                    {isLoading ? 'AI採点中...' : 'AIで採点する'}
                </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {result && (
                <div className={styles.resultArea}>
                    <div className={styles.scoreHeader}>
                        <div className={styles.scoreCircle}>
                            <span className={styles.scoreLabel}>スコア</span>
                            <span className={styles.scoreValue}>{result.score}</span>
                        </div>
                        {!hideChart && (
                            <div className={styles.radarContainer}>
                                <RechartsScoreRadar data={result.radarChartData} />
                            </div>
                        )}
                    </div>

                    <div className={styles.feedbackSection}>
                        <h3>AIフィードバック</h3>
                        <div className={styles.markdownBody}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath] as any}
                                rehypePlugins={[rehypeRaw, rehypeKatex] as any}
                                components={markdownComponents}
                            >
                                {normalizedFeedback}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {result.mermaidDiagram && (
                        <div className={styles.mermaidSection}>
                            <h3>改善プロセス</h3>
                            <Mermaid chart={result.mermaidDiagram} />
                        </div>
                    )}

                    {result.improvedAnswer && (
                        <div className={styles.improvedSection}>
                            <h3>改善された回答例</h3>
                            <div className={styles.markdownBody}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath] as any}
                                    rehypePlugins={[rehypeRaw, rehypeKatex] as any}
                                    components={markdownComponents}
                                >
                                    {normalizedImprovedAnswer}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
