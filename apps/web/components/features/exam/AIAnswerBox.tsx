
'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import rehypeRaw from 'rehype-raw';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import dynamic from 'next/dynamic';
import styles from './AIAnswerBox.module.css';

// Dynamically import Mermaid to avoid SSR issues
const Mermaid = dynamic(() => import('@/components/ui/Mermaid'), { ssr: false });

interface AIAnswerBoxProps {
    questionText: string;
    modelAnswer?: string; // Optional, might be hidden in some modes
    limit?: number;
    initialAnswer?: string;
    initialResult?: ScoreResult;
    onSave?: (data: { answer: string; result: ScoreResult }) => void;
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
    initialAnswer = '',
    initialResult,
    onSave,
    hideChart = false
}: AIAnswerBoxProps & { hideChart?: boolean }) {
    const [answer, setAnswer] = useState(initialAnswer);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ScoreResult | null>(initialResult || null);
    const [error, setError] = useState<string | null>(null);

    const handleScore = async () => {
        if (!answer.trim()) return;
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

            if (!response.ok) {
                throw new Error(data.error || '採点中にエラーが発生しました');
            }

            setResult(data);

            // Notify parent to save persistence
            if (onSave) {
                onSave({ answer, result: data });
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || '通信エラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.inputWrapper}>
                <textarea
                    className={styles.textarea}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="ここに回答を入力してください..."
                    rows={5}
                    disabled={isLoading}
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
            </div>

            <div className={styles.actions}>
                <button
                    onClick={handleScore}
                    disabled={!answer.trim() || isLoading}
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
                                <ResponsiveContainer width="100%" height={200}>
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={result.radarChartData}>
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
                            </div>
                        )}
                    </div>

                    <div className={styles.feedbackSection}>
                        <h3>AIフィードバック</h3>
                        <div className={styles.markdownBody}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath] as any}
                                rehypePlugins={[rehypeKatex, rehypeRaw] as any}
                            >
                                {result.feedback}
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
                                    rehypePlugins={[rehypeKatex, rehypeRaw] as any}
                                >
                                    {result.improvedAnswer}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
