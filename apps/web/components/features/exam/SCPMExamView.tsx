
'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import dynamic from 'next/dynamic';
import { Question } from '@/lib/api';
import styles from './SCPMExamView.module.css';
// Replaced missing UI components with native elements
// import { Badge } from '@/components/ui/badge';
// import { Button } from '@/components/ui/button';

// Dynamic import for Mermaid to avoid SSR issues
const Mermaid = dynamic(() => import('@/components/ui/Mermaid'), { ssr: false });
import AIAnswerBox from './AIAnswerBox';
import { ScoreResult } from './AIAnswerBox';

interface SCPMExamViewProps {
    question: Question;
    onAnswerSubmit?: (subQNo: string | number, answer: string) => void;
    onGrade?: (data: { answer: string; result: ScoreResult }, subQIndex: number) => void;
    descriptiveHistory?: Record<string, { answer: string; result: any }>; // Pass history
}
// Import logic for chart
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { useRef, useEffect } from 'react';

export default function SCPMExamView({ question, onAnswerSubmit, onGrade, descriptiveHistory }: SCPMExamViewProps) {
    const { context, questions } = question;
    const [selectedDiagram, setSelectedDiagram] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'context' | 'answer'>('context');
    // Layout Mode: default (3-col/split), focus (2-col/split no nav), paper (answer only)
    const [layoutMode, setLayoutMode] = useState<'default' | 'focus' | 'paper'>('default');

    // Split View Resizing
    const [contextWidth, setContextWidth] = useState(60); // percent
    const isResizing = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const container = document.querySelector(`.${styles.splitContainer}`) as HTMLElement;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

            // Limit between 20% and 80%
            if (newWidth >= 20 && newWidth <= 80) {
                setContextWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto'; // Re-enable selection
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const startResizing = () => {
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    };

    if (!context) {
        return <div className={styles.errorMessage}>Error: No context data found for this PM question.</div>;
    }

    // Process background text to replace {{diagram:id}} with interactive buttons or placeholders
    // For the prototype, we might just strip them or wrap them in a span to show a "View Diagram" button inline.
    // But rendering diagrams strictly at the point of insertion is better.
    // However, react-markdown won't easily let us inject complex components mid-stream without custom components.
    // Strategy: Replace {{diagram:id}} with a special markdown link or custom syntax, then mapped by components.
    // Or, for now, we just render the text, AND show all diagrams in a "Reference" tab or floating panel?
    // User requested "Context Assist" -> "Related Diagram" buttons.

    // Simple approach: Split text by {{diagram:id}}?
    // Let's use a regex to replace {{diagram:id}} with a custom directive for ReactMarkdown if possible,
    // or just render the diagram IN PLACE if it's a block.

    const renderContextWithDiagrams = (text: string) => {
        // We will split the text by the diagram placeholder pattern
        const parts = text.split(/({{diagram:[^}]+}})/g);

        return parts.map((part, index) => {
            const match = part.match(/{{diagram:([^}]+)}}/);
            if (match) {
                const diagramId = match[1];
                const diagram = context.diagrams?.find(d => d.id === diagramId);

                if (!diagram) return <div key={index} className={styles.errorMessage}>[Missing Diagram: {diagramId}]</div>;

                return (
                    <div key={index} className={styles.diagramContainer}>
                        <div className={styles.diagramLabel}>{diagram.label}</div>
                        <div className={styles.diagramContent}>
                            {diagram.type === 'mermaid' ? (
                                <Mermaid chart={diagram.content} />
                            ) : diagram.type === 'markdown' ? (
                                <div className={styles.markdownContent}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm] as any} rehypePlugins={[rehypeRaw] as any}>
                                        {diagram.content}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <div className={styles.errorMessage}>
                                    [Image/Other Diagram Type: {diagram.type}]
                                    <pre style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>{diagram.content}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            // Standard Text
            return (
                <div key={index} className={styles.markdownContent}>
                    <ReactMarkdown remarkPlugins={[remarkGfm] as any} rehypePlugins={[rehypeRaw] as any}>
                        {part}
                    </ReactMarkdown>
                </div>
            );
        });
    };

    // Calculate Aggregate Radar Data
    // We need to sum up scores for each subject across all answered questions
    // This is a bit tricky as the structure might differ, but let's assume consistent subject keys 'A', 'B', 'C' etc or 'Knowledge', 'Logic'..
    // Based on `AIAnswerBox` it uses `subject` field.

    // Default Empty Data
    const defaultRadar = [
        { subject: '的確性', A: 0, fullMark: 10 },
        { subject: '論理性', A: 0, fullMark: 10 },
        { subject: '用語', A: 0, fullMark: 10 },
        { subject: '網羅性', A: 0, fullMark: 10 },
        { subject: '具体性', A: 0, fullMark: 10 },
    ];

    let aggregatedData = [...defaultRadar];
    let totalScore = 0;
    let maxScore = 0;

    if (descriptiveHistory) {
        // Sum up
        let count = 0;
        Object.values(descriptiveHistory).forEach(entry => {
            if (entry.result && entry.result.radarChartData) {
                count++;
                totalScore += entry.result.score || 0;
                maxScore += 100; // Assume 100 per question

                entry.result.radarChartData.forEach((d: any) => {
                    const target = aggregatedData.find(ad => ad.subject === d.subject);
                    if (target) {
                        target.A += d.A;
                        target.fullMark += d.fullMark;
                    }
                });
            }
        });

        // Average it? Or Sum?
        // User said "Weighting per question".
        // If we show "Total Ability", average makes sense for 1-5 scale, 
        // but if we show accumulated score, sum.
        // Radar charts usually show "Balance". Let's Average the values for the chart shape.
        if (count > 0) {
            aggregatedData = aggregatedData.map(d => ({
                ...d,
                A: parseFloat((d.A / count).toFixed(1)), // Average score
                fullMark: d.fullMark // Keep scale
            }));
        }
    }



    return (
        <div className={`${styles.container} ${styles[`layoutMode_${layoutMode}`]}`}>
            {/* Desktop Layout Toggle (Visible on large screens) */}
            <div className={styles.layoutControls}>
                <div className={styles.layoutToggleGroup}>
                    <button
                        onClick={() => setLayoutMode('default')}
                        className={`${styles.layoutToggleBtn} ${layoutMode === 'default' ? styles.active : ''}`}
                        title="標準 (3カラム)"
                    >
                        標準
                    </button>
                    <button
                        onClick={() => setLayoutMode('focus')}
                        className={`${styles.layoutToggleBtn} ${layoutMode === 'focus' ? styles.active : ''}`}
                        title="集中 (ナビ非表示)"
                    >
                        集中
                    </button>
                    <button
                        onClick={() => setLayoutMode('paper')}
                        className={`${styles.layoutToggleBtn} ${layoutMode === 'paper' ? styles.active : ''}`}
                        title="解答のみ (1カラム)"
                    >
                        解答のみ
                    </button>
                </div>
            </div>
            {/* Mobile Tab Navigation (Visible only on small screens) */}
            <div className={styles.mobileNav}>
                <button
                    onClick={() => setActiveTab('context')}
                    className={`${styles.mobileNavButton} ${activeTab === 'context' ? styles.active : ''}`}
                >
                    📖 問題文
                </button>
                <button
                    onClick={() => setActiveTab('answer')}
                    className={`${styles.mobileNavButton} ${activeTab === 'answer' ? styles.active : ''}`}
                >
                    ✏️ 解答用紙
                </button>
            </div>

            <div className={styles.splitContainer}>
                {/* Left Pane: Context (Scrollable) */}
                <div
                    className={`${styles.pane} ${styles.contextPane} ${activeTab === 'context' ? styles.active : ''}`}
                    style={layoutMode !== 'paper' && activeTab === 'context' ? { width: `${contextWidth}%` } : undefined}
                >
                    <div className={styles.contextHeader}>
                        <h1 className={styles.contextTitle}>{context.title}</h1>
                        <span className={styles.contextBadge}>
                            PM / SC Exam Context
                        </span>
                    </div>

                    <div className={styles.contextContent}>
                        {renderContextWithDiagrams(context.background)}
                    </div>
                </div>

                {/* Resizer Handle (Desktop only, visible if not paper/mobile) */}
                <div
                    className={styles.resizer}
                    onMouseDown={startResizing}
                    style={{ display: layoutMode === 'paper' || activeTab !== 'context' ? 'none' : 'block' }} // Hide in paper mode or mobile tab view logic if applicable, though activeTab is mobile only.
                >
                    <div className={styles.resizerHandle} />
                </div>

                {/* Right Pane: Questions (Scrollable) */}
                <div
                    className={`${styles.pane} ${styles.answerPane} ${activeTab === 'answer' ? styles.active : ''}`}
                    style={layoutMode !== 'paper' && activeTab === 'context' ? { width: `${100 - contextWidth}%` } : undefined}
                >
                    <div className={styles.answerPaneHeader}>
                        <div>
                            <h2 className={styles.answerPaneTitle}>設問一覧</h2>
                            <p className={styles.answerPaneSubtitle}>全{questions?.length || 0}問</p>
                        </div>
                        {/* Total Score Display */}
                        <div className={styles.scoreDisplay}>
                            <div className={styles.scoreLabel}>総合スコア (目安)</div>
                            <div className={styles.scoreValue}>
                                {totalScore} <span className={styles.scoreMax}>/ {questions ? questions.length * 100 : 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Global Radar Chart Area */}
                    {totalScore > 0 && (
                        <div className={styles.radarContainer}>
                            <h3 className={styles.radarTitle}>回答傾向分析 (全設問平均)</h3>
                            <div className={styles.radarChart}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={aggregatedData}>
                                        <PolarGrid stroke="var(--border-color)" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 10]} hide />
                                        <Radar
                                            name="Average"
                                            dataKey="A"
                                            stroke="var(--accent-color)"
                                            fill="var(--accent-color)"
                                            fillOpacity={0.5}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <div className={styles.questionsList}>
                        {questions?.map((q, idx) => (
                            <SubQuestionBlock
                                key={q.id || idx}
                                question={q}
                                index={idx}
                                parentContext={context}
                                onGrade={onGrade ? (data) => onGrade(data, idx) : undefined}
                                initialData={descriptiveHistory ? descriptiveHistory[q.id || `sq-${idx}`] : undefined}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

}

function SubQuestionBlock({ question, index, parentContext, onGrade, initialData }: { question: any, index: number, parentContext: any, onGrade?: (data: any) => void, initialData?: any }) {
    return (
        <div className={styles.subQuestionBlock}>
            <div className={styles.subQuestionHeader}>
                <span className={styles.subQuestionNumber}>Q{question.subQNo || index + 1}</span>
                <div className={`${styles.markdownContent} ${styles.subQuestionText}`}>
                    <ReactMarkdown>{question.text}</ReactMarkdown>
                </div>
            </div>

            {/* Sub-sub questions if any */}
            {question.subQuestions && question.subQuestions.length > 0 && (
                <div className={styles.subQuestionsList}>
                    {question.subQuestions.map((sq: any, sIdx: number) => (
                        <SubQuestionItem
                            key={sIdx}
                            sq={sq}
                            sIdx={sIdx}
                            onGrade={onGrade}
                            initialData={initialData}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function SubQuestionItem({ sq, sIdx, onGrade, initialData }: { sq: any, sIdx: number, onGrade?: (data: any) => void, initialData?: any }) {
    const [showExplanation, setShowExplanation] = useState(false);

    return (
        <div className={styles.subQuestionItem}>
            <div className={styles.subQuestionItemHeader}>
                <span className={styles.subQuestionLabel}>
                    {sq.label}
                </span>
                <div className={`${styles.markdownContent} ${styles.subQuestionItemText}`}>
                    <ReactMarkdown>{sq.text}</ReactMarkdown>
                </div>
            </div>

            {/* AI Grading Box */}
            <div style={{ marginTop: '1rem' }}>
                <AIAnswerBox
                    questionText={`[${sq.label}] ${sq.text}`}
                    modelAnswer={sq.answer}
                    onSave={onGrade}
                    initialAnswer={initialData?.answer}
                    initialResult={initialData?.result}
                    hideChart={true}
                />
            </div>

            <div className={styles.explanationToggle}>
                <button
                    onClick={() => setShowExplanation(!showExplanation)}
                    className={styles.explanationButton}
                >
                    {showExplanation ? "解答例を隠す" : "解答例を表示"}
                </button>

                {showExplanation && (
                    <div className={styles.explanationContent}>
                        <div className={styles.explanationHeader}>
                            <span>解答例:</span>
                            <span className={styles.explanationAnswer}>{sq.answer}</span>
                        </div>
                        <div className={styles.explanationText}>
                            <span className={styles.explanationBadge}>
                                AIによる解説
                            </span>
                            <p style={{ marginTop: '0.5rem' }}>{sq.explanation}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
