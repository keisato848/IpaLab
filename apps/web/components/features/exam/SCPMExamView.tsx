
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

export default function SCPMExamView({ question, onAnswerSubmit, onGrade, descriptiveHistory }: SCPMExamViewProps) {
    const { context, questions } = question;
    const [selectedDiagram, setSelectedDiagram] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'context' | 'questions'>('context');

    if (!context) {
        return <div className="p-4 text-red-500">Error: No context data found for this PM question.</div>;
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

                if (!diagram) return <div key={index} className="text-red-400">[Missing Diagram: {diagramId}]</div>;

                return (
                    <div key={index} className="my-6 border rounded-lg p-4 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="text-sm font-semibold text-gray-500 mb-2">{diagram.label}</div>
                        {diagram.type === 'mermaid' ? (
                            <div className="overflow-x-auto">
                                <Mermaid chart={diagram.content} />
                            </div>
                        ) : diagram.type === 'markdown' ? (
                            <div className="overflow-x-auto prose dark:prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm] as any} rehypePlugins={[rehypeRaw] as any}>
                                    {diagram.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <div className="p-4 bg-gray-100 text-gray-800 rounded">
                                [Image/Other Diagram Type: {diagram.type}]
                                <pre className="text-xs mt-2">{diagram.content}</pre>
                            </div>
                        )}
                    </div>
                );
            }

            // Standard Text
            return (
                <div key={index} className="prose dark:prose-invert max-w-none">
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
        <div className="flex flex-col h-screen max-h-[calc(100vh-64px)] overflow-hidden">
            {/* Mobile Tab Navigation (Visible only on small screens) */}
            <div className="lg:hidden flex border-b bg-white dark:bg-zinc-900 flex-none">
                <button
                    onClick={() => setActiveTab('context')}
                    className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 ${activeTab === 'context' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                >
                    問題文 (Context)
                </button>
                <button
                    onClick={() => setActiveTab('questions')}
                    className={`flex-1 py-3 text-sm font-semibold text-center transition-colors border-b-2 ${activeTab === 'questions' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                >
                    設問 (Questions)
                </button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                {/* Left Pane: Context (Scrollable) */}
                <div className={`lg:w-1/2 w-full h-full overflow-y-auto border-r border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 p-6 scroll-smooth ${activeTab === 'context' ? 'block' : 'hidden lg:block'}`}>
                    <div className="mb-6">
                        <h1 className="text-xl font-bold mb-2">{context.title}</h1>
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-4 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                            PM / SC Exam Context
                        </span>
                    </div>

                    <div className="space-y-4 text-base leading-relaxed text-gray-800 dark:text-gray-200 font-serif lg:font-sans">
                        {renderContextWithDiagrams(context.background)}
                    </div>
                </div>

                {/* Right Pane: Questions (Scrollable) */}
                <div className={`lg:w-1/2 w-full h-full overflow-y-auto bg-white dark:bg-zinc-900 p-6 ${activeTab === 'questions' ? 'block' : 'hidden lg:block'}`}>
                    <div className="mb-4 border-b pb-2 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-semibold">設問一覧</h2>
                            <p className="text-sm text-gray-500">全{questions?.length || 0}問</p>
                        </div>
                        {/* Total Score Display */}
                        <div className="text-right">
                            <div className="text-xs text-gray-500">総合スコア (目安)</div>
                            <div className="text-xl font-bold text-blue-600">{totalScore} <span className="text-sm text-gray-400">/ {questions ? questions.length * 100 : 0}</span></div>
                        </div>
                    </div>

                    {/* Global Radar Chart Area */}
                    {totalScore > 0 && (
                        <div className="mb-8 p-4 bg-white dark:bg-zinc-800 rounded-xl border shadow-sm">
                            <h3 className="text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">回答傾向分析 (全設問平均)</h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={aggregatedData}>
                                        <PolarGrid stroke="#e5e7eb" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 10]} hide />
                                        <Radar
                                            name="Average"
                                            dataKey="A"
                                            stroke="#3b82f6"
                                            fill="#3b82f6"
                                            fillOpacity={0.5}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <div className="space-y-12">
                        {questions?.map((q, idx) => (
                            <SubQuestionBlock
                                key={q.id || idx}
                                question={q}
                                index={idx}
                                parentContext={context}
                                onGrade={onGrade ? (data) => onGrade(data, idx) : undefined}
                                // Pass history for this specific sub-question
                                // ID strategy: we need to match how QuestionClient stores it.
                                // QuestionClient fetches by DB record.
                                // record.questionId.
                                // If we don't have exact IDs, assume idx-based?
                                // Actually, `descriptiveHistory` is keyed by questionId.
                                // q.id should be the key if available.
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
    // State moved to SubQuestionItem
    return (
        <div className="border-b last:border-0 pb-8">
            <div className="flex items-baseline gap-2 mb-3">
                <span className="text-lg font-bold text-blue-600">Q{question.subQNo || index + 1}</span>
                <div className="prose dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 font-medium">
                    <ReactMarkdown>{question.text}</ReactMarkdown>
                </div>
            </div>

            {/* Sub-sub questions if any */}
            {question.subQuestions && question.subQuestions.length > 0 && (
                <div className="ml-6 space-y-6 mt-4">
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
        <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg">
            <div className="flex gap-2 items-center mb-2">
                <span className="text-sm font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 px-2 py-0.5 rounded">
                    {sq.label}
                </span>
                <div className="text-sm prose dark:prose-invert">
                    <ReactMarkdown>{sq.text}</ReactMarkdown>
                </div>
            </div>

            {/* AI Grading Box */}
            <div className="mt-4">
                <AIAnswerBox
                    questionText={`[${sq.label}] ${sq.text}`}
                    modelAnswer={sq.answer}
                    onSave={onGrade}
                    initialAnswer={initialData?.answer}
                    initialResult={initialData?.result}
                    hideChart={true} // Hide individual chart
                />
            </div>

            <div className="mt-3">
                <button
                    onClick={() => setShowExplanation(!showExplanation)}
                    className="text-xs px-3 py-1.5 border border-blue-500 text-blue-600 rounded-full hover:bg-blue-50 transition-colors font-semibold"
                >
                    {showExplanation ? "解答例を隠す" : "解答例を表示"}
                </button>

                {showExplanation && (
                    <div className="mt-3 p-3 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10 text-sm">
                        <div className="font-bold flex items-center gap-2 mb-1">
                            <span>解答例:</span>
                            <span className="font-mono text-lg">{sq.answer}</span>
                        </div>
                        <div className="mt-2 text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                                    AIによる解説
                                </span>
                            </div>
                            <p>{sq.explanation}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
