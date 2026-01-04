'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import rehypeRaw from 'rehype-raw';
// @ts-ignore
import he from 'he';
import styles from './QuestionClient.module.css';
import { Question, saveLearningRecord, LearningRecord, getLearningRecords } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { v4 as uuidv4 } from 'uuid';
import { getExamLabel } from '@/lib/exam-utils';
import dynamic from 'next/dynamic';

const Mermaid = dynamic(() => import('@/components/ui/Mermaid'), { ssr: false });
// ... imports
import ExamSummary from './ExamSummary';
import AIAnswerBox from './AIAnswerBox';



interface QuestionClientProps {
    question: Question;
    year: string;
    type: string;
    qNo: string; // Current qNo from URL
    totalQuestions: number;
}

export default function QuestionClient({ question, year, type, qNo, totalQuestions }: QuestionClientProps) {
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode') || 'practice';
    const router = useRouter();
    const { data: session } = useSession();
    const { showExamStats, toggleShowExamStats } = useTheme();

    // Local state for settings popup
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [startTime, setStartTime] = useState<number>(Date.now());

    // Stats State
    const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });
    const [pastStats, setPastStats] = useState<{ total: number; correct: number } | null>(null);
    const [examStats, setExamStats] = useState<{ total: number; correct: number } | null>(null);
    const [allExamRecords, setAllExamRecords] = useState<LearningRecord[]>([]);


    // Mock Mode Logic
    const isMock = mode === 'mock';
    const [timeLeft, setTimeLeft] = useState(150 * 60); // 150 minutes in seconds

    // Simple Timer Effect (Mock Mode only)
    useEffect(() => {
        if (!isMock) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [isMock]);

    // AI Score Persistence State
    const [descriptiveHistory, setDescriptiveHistory] = useState<Record<string, { answer: string; result: any }>>({});

    // Load history on mount or question change
    useEffect(() => {
        if (!session?.user?.id) return;

        // Fetch records for this exam to populate history
        async function fetchHistory() {
            try {
                const userId = session?.user?.id || guestManager.getGuestId();
                if (!userId) return;

                const records = await getLearningRecords(userId, question.examId);
                const historyMap: Record<string, { answer: string; result: any }> = {};

                records.forEach(r => {
                    if (r.isDescriptive && r.userAnswer && r.questionId) {
                        // Map by questionId (need to ensure questionId matches sub-question ID generation logic)
                        // Current logic uses constructed IDs for sub-questions? 
                        // Wait, sub-questions don't have unique IDs in the raw data usually, unless we construct them.
                        // For saving, we need a consistent ID strategy.
                        // Let's assume we construct ID as `${question.id}-${subQIndex}-${sqIndex}` if needed, or just match by exact logic?
                        // The API expects `questionId`.
                        // Using the unique ID stored in record.
                        historyMap[r.questionId] = {
                            answer: r.userAnswer,
                            result: {
                                score: r.aiScore || 0,
                                radarChartData: r.aiRadarData || [],
                                feedback: r.aiFeedback || '',
                                mermaidDiagram: undefined, // Not typically saved/needed to restore immediately? Or save it? Schema has no mermaid field yet?
                                // Wait, schema didn't have mermaidDiagram string.
                                // If we want to restore mermaid, we need to save it or regenerate it?
                                // User req didn't explicitly ask for mermaid persistence, but "CLKS data structure".
                                // I'll skip mermaid restoration for now or mock it if needed.
                                // Update: I can add mermaid to schema if I want, but I'll stick to requested fields.
                            }
                        };
                    }
                });
                setDescriptiveHistory(historyMap);
            } catch (e) {
                console.error("Failed to load history", e);
            }
        }
        fetchHistory();
    }, [question.id, session?.user?.id, question.examId]);

    // Reset state when question changes
    useEffect(() => {
        setSelectedOption(null);
        setShowExplanation(false);
        setStartTime(Date.now());

        // Fetch Past Stats (Current Question) & Exam Stats (Current Exam)
        async function fetchStats() {
            try {
                const userId = session?.user?.id || guestManager.getGuestId();
                if (!userId) return;

                // 1. Past Stats for this Question
                const qRecords = await getLearningRecords(userId, undefined, question.id);
                if (qRecords.length > 0) {
                    const correctCount = qRecords.filter(r => r.isCorrect).length;
                    setPastStats({ total: qRecords.length, correct: correctCount });
                } else {
                    setPastStats(null);
                }

                // 2. Cumulative Stats for this Exam (All records for this examId)
                const eRecords = await getLearningRecords(userId, question.examId);
                if (eRecords.length > 0) {
                    setAllExamRecords(eRecords);
                    // Session Stats (Today's records)
                    const today = new Date().toISOString().split('T')[0];
                    const todaysRecords = eRecords.filter(r => r.answeredAt.startsWith(today));
                    if (todaysRecords.length > 0) {
                        const sCorrect = todaysRecords.filter(r => r.isCorrect).length;
                        setSessionStats({ total: todaysRecords.length, correct: sCorrect });
                    }

                    const eCorrect = eRecords.filter(r => r.isCorrect).length;
                    setExamStats({ total: eRecords.length, correct: eCorrect });
                } else {
                    setExamStats(null);
                }
            } catch (e) {
                console.error("Failed to fetch stats", e);
            }
        }
        fetchStats();
    }, [question.id, question.examId, session]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isPractice = mode === 'practice';

    const getSubQId = (baseId: string, idx: number, subIdx?: number) => {
        return `${baseId}-${idx}${subIdx !== undefined ? `-${subIdx}` : ''}`;
    };

    const handleSaveAIScore = async (data: { answer: string; result: any }, subQIdx: number, subSubIdx?: number) => {
        const qId = getSubQId(question.id, subQIdx, subSubIdx);
        const record: LearningRecord = {
            id: uuidv4(),
            userId: session?.user?.id || guestManager.getGuestId() || 'anonymous',
            questionId: qId,
            examId: question.examId,
            category: question.category,
            subCategory: question.subCategory,
            isDescriptive: true,
            userAnswer: data.answer,
            aiScore: data.result.score,
            aiFeedback: data.result.feedback,
            aiRadarData: data.result.radarChartData,
            isCorrect: (data.result.score || 0) >= 60,
            answeredAt: new Date().toISOString(),
            timeTakenSeconds: 0,
        };

        try {
            if (session?.user?.id) {
                await saveLearningRecord(record);
            } else {
                guestManager.saveHistory(record);
            }

            // Update History State
            setDescriptiveHistory(prev => ({
                ...prev,
                [qId]: { answer: data.answer, result: data.result }
            }));

            // Update All Records for Summary
            setAllExamRecords(prev => {
                const filtered = prev.filter(r => r.questionId !== qId);
                return [...filtered, record];
            });

        } catch (e) {
            console.error("Failed to save AI score", e);
        }
    };

    const handleOptionClick = async (optionId: string) => {
        if (showExplanation && isPractice) return; // Prevent changing answer after showing explanation
        setSelectedOption(optionId);
        if (isPractice) {
            setShowExplanation(true);
            await saveResult(optionId);
        }
    };

    const saveResult = async (optionId: string) => {
        const isCorrect = optionId === question.correctOption;
        const timeTaken = Math.floor((Date.now() - startTime) / 1000);

        const record: LearningRecord = {
            id: uuidv4(),
            userId: session?.user?.id || guestManager.getGuestId() || 'anonymous',
            questionId: question.id,
            examId: question.examId,
            category: question.category,
            subCategory: question.subCategory,
            isCorrect,
            answeredAt: new Date().toISOString(),
            timeTakenSeconds: timeTaken,
        };

        if (session) {
            try {
                await saveLearningRecord(record);
            } catch (e) {
                console.error("Failed to save to API", e);
            }
        } else {
            guestManager.saveHistory(record);
        }

        // Update Session Stats
        setSessionStats(prev => ({
            total: prev.total + 1,
            correct: prev.correct + (isCorrect ? 1 : 0)
        }));

        // Update Exam Stats (Optimistic)
        setExamStats(prev => {
            const currentTotal = prev?.total || 0;
            const currentCorrect = prev?.correct || 0;
            return {
                total: currentTotal + 1,
                correct: currentCorrect + (isCorrect ? 1 : 0)
            };
        });
    };

    const handleNext = () => {
        const currentInt = parseInt(qNo);
        if (currentInt < totalQuestions) {
            const nextQ = currentInt + 1;
            router.push(`/exam/${year}/${type}/${nextQ}?mode=${mode}`);
        } else {
            router.push(`/exam/${year}/${type}/result?mode=${mode}`);
        }
    };

    // Construct Exam ID safely
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;
    const examLabel = getExamLabel(examId);

    const isPM = question.isPM || type.includes('PM') || (type === 'AM2' && (question.text && question.text.length > 1000 || question.subQuestions && question.subQuestions.length > 0));

    // Custom renderer for ReactMarkdown to handle Mermaid
    const components = {
        code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            if (!inline && match && match[1] === 'mermaid') {
                const rawChildren = String(children);
                let chartContent = he.decode(rawChildren).replace(/\n$/, '');
                // Hotfix for common invalid mermaid syntax in datasets
                // 1. Comment out "note:" lines that aren't valid formatting
                chartContent = chartContent.replace(/(\n\s*)note:/gi, '$1%% note:');
                return <Mermaid chart={chartContent} />;
            }
            return !inline && match ? (
                <code className={className} {...props}>
                    {children}
                </code>
            ) : (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        }
    };

    // PM Mode State
    const [currentSubQIndex, setCurrentSubQIndex] = useState(0);

    // Flatten subQuestions if nested, or use direct list.
    const subQs = question.subQuestions || [];
    const currentSubQ = subQs[currentSubQIndex];

    const handleSubNext = () => {
        if (currentSubQIndex < subQs.length - 1) {
            setCurrentSubQIndex(prev => prev + 1);
        }
    };

    const handleSubPrev = () => {
        if (currentSubQIndex > 0) {
            setCurrentSubQIndex(prev => prev - 1);
        }
    };

    if (isPM) {
        return (
            <div className={styles.container}>
                <ExamSummary
                    records={allExamRecords}
                    questions={[question]}
                    title="現在の設問（ケーススタディ）のスコア状況"
                />

                <header className={styles.header}>
                    <div className={styles.examInfo}>
                        <span className={styles.examBadge}>{type}</span>
                        <span className={styles.examTitle}>{examLabel} - Q{qNo} (記述)</span>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                    {/* Left Panel: Question Text */}
                    <div className={styles.pmPanel}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>
                            {question.subCategory || '問題文'}
                        </h2>
                        <div className={styles.markdownBody}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath] as any}
                                rehypePlugins={[rehypeKatex, rehypeRaw] as any}
                                components={components}
                            >
                                {question.text}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {/* Right Panel: Sub Questions */}
                    <div className={styles.pmPanel}>
                        {currentSubQ ? (
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                                    {currentSubQ.subQNo || `設問 ${currentSubQIndex + 1}`}
                                </h3>
                                <div className={styles.markdownBody}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath] as any}
                                        rehypePlugins={[rehypeKatex, rehypeRaw] as any}
                                        components={components}
                                    >
                                        {currentSubQ.text}
                                    </ReactMarkdown>
                                </div>
                                <AIAnswerBox
                                    questionText={`${question.text}\n\n${currentSubQ.text}`}
                                    modelAnswer=""
                                    initialAnswer={descriptiveHistory[getSubQId(question.id, currentSubQIndex)]?.answer}
                                    initialResult={descriptiveHistory[getSubQId(question.id, currentSubQIndex)]?.result}
                                    onSave={(data) => handleSaveAIScore(data, currentSubQIndex)}
                                />
                            </div>
                        ) : (
                            <div>設問データがありません</div>
                        )}
                    </div>
                </div>

                <footer className={styles.footer} style={{ marginTop: '2rem' }}>
                    <button
                        className={styles.navBtn}
                        onClick={handleSubPrev}
                        disabled={currentSubQIndex === 0}
                    >
                        前の設問
                    </button>
                    <span style={{ margin: '0 1rem', fontWeight: 'bold' }}>
                        {currentSubQIndex + 1} / {subQs.length}
                    </span>
                    <button
                        className={styles.navBtn}
                        onClick={handleSubNext}
                        disabled={currentSubQIndex === subQs.length - 1}
                    >
                        次の設問
                    </button>
                    <Link href={`/exam/${year}/${type}`} className={styles.navBtn} style={{ marginLeft: 'auto' }}>
                        一覧へ戻る
                    </Link>
                </footer>
            </div >
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.examInfo}>
                    <span className={`${styles.examBadge} ${styles.mobileHidden}`}>{type}</span>
                    <span className={styles.examTitle}>
                        <span className={styles.mobileHidden}>{examLabel} - </span>
                        Q{qNo}
                    </span>
                </div>

                {/* Progress Bar for Practice Mode */}
                {isPractice && (
                    <div style={{ flex: 1, margin: '0 2rem', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                            <span>Progress</span>
                            <span>{qNo} / {totalQuestions}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                                style={{
                                    width: `${(parseInt(qNo) / totalQuestions) * 100}%`,
                                    height: '100%',
                                    background: '#3b82f6',
                                    transition: 'width 0.3s ease'
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className={styles.meta}>
                    <span className={`${styles.modeBadge} ${isMock ? styles.mockBadge : ''} ${styles.mobileHidden}`}>
                        {isPractice ? '練習モード' : '模擬試験モード'}
                    </span>
                    {/* Header Stats / Settings Toggle */}
                    <div className={styles.headerControls}>
                        {/* Desktop: Show Stats inline if enabled */}
                        <div className={`${styles.statsContainer} ${styles.mobileHidden}`}>
                            {showExamStats && (
                                <>
                                    {isPractice && sessionStats.total > 0 && (
                                        <span className={styles.statItem} title="今回の正答率">
                                            今回: {Math.round((sessionStats.correct / sessionStats.total) * 100)}% ({sessionStats.correct}/{sessionStats.total})
                                        </span>
                                    )}
                                    {examStats && examStats.total > 0 && (
                                        <span className={styles.statItem} title="この試験の通算正答率">
                                            通算: {Math.round((examStats.correct / examStats.total) * 100)}% ({examStats.correct}/{examStats.total})
                                        </span>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Mobile/Global: Settings Button */}
                        <button
                            className={styles.settingsBtn}
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            aria-label="表示設定"
                        >
                            ⚙️
                        </button>

                        {/* Settings Popup */}
                        {isSettingsOpen && (
                            <div className={styles.settingsPopup}>
                                <div className={styles.popupHeader}>
                                    <span>表示設定</span>
                                    <button onClick={() => setIsSettingsOpen(false)}>×</button>
                                </div>
                                <label className={styles.settingRow}>
                                    <span>統計情報を表示</span>
                                    <input
                                        type="checkbox"
                                        checked={showExamStats}
                                        onChange={toggleShowExamStats}
                                    />
                                </label>

                                {/* Mobile Only Stats in Popup */}
                                {showExamStats && (
                                    <div className={styles.popupStats}>
                                        <div className={styles.popupStatRow}>
                                            <span>今回:</span>
                                            <span>{sessionStats.total > 0 ? `${Math.round((sessionStats.correct / sessionStats.total) * 100)}%` : '-'}</span>
                                        </div>
                                        <div className={styles.popupStatRow}>
                                            <span>通算:</span>
                                            <span>{examStats && examStats.total > 0 ? `${Math.round((examStats.correct / examStats.total) * 100)}%` : '-'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {isMock && (
                        <span className={styles.timer}>
                            ⏳ {formatTime(timeLeft)}
                        </span>
                    )}
                </div>
            </header>

            <div className={styles.content}>
                {/* Left: Question Body */}
                <div className={styles.questionPanel}>
                    <div className={styles.markdownBody}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath] as any}
                            rehypePlugins={[rehypeKatex, rehypeRaw] as any}
                            components={components}
                        >
                            {question.text}
                        </ReactMarkdown>
                    </div>
                    <div className={styles.sourceParams}>
                        出典：{examLabel} 問{qNo}
                        {pastStats && (
                            <span style={{ marginLeft: '1rem', color: '#666', fontSize: '0.9em' }}>
                                (過去の正答率: {Math.round((pastStats.correct / pastStats.total) * 100)}% - {pastStats.correct}/{pastStats.total}回)
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Options & Interaction */}
                <div className={styles.interactionPanel}>
                    <div className={styles.optionsList}>
                        {question.options?.map((opt) => {
                            const isSelected = selectedOption === opt.id;
                            const isCorrect = opt.id === question.correctOption;

                            // Styling logic
                            let optionClass = styles.optionBtn;

                            if (isPractice && showExplanation) {
                                // Practice Mode Result Styling
                                if (isSelected) {
                                    optionClass += isCorrect
                                        ? ` ${styles.correctSelected}`
                                        : ` ${styles.incorrectSelected}`;
                                } else if (isCorrect) {
                                    optionClass += ` ${styles.correctHighlight}`;
                                }
                            } else {
                                // Normal Selection (Practice Initial or Mock Mode)
                                if (isSelected) {
                                    optionClass += ` ${styles.selected}`;
                                }
                            }

                            return (
                                <button
                                    key={opt.id}
                                    className={optionClass}
                                    onClick={() => handleOptionClick(opt.id)}
                                    disabled={showExplanation && isPractice}
                                >
                                    <span className={styles.optId}>{opt.id}</span>
                                    <span className={styles.optText}>{opt.text}</span>
                                    {showExplanation && isPractice && isSelected && (
                                        <span className={styles.resultIcon}>{isCorrect ? '⭕' : '❌'}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Explanation Area (Condensed or Expanded) */}
                    {showExplanation && isPractice && (
                        <div className={styles.explanationArea}>
                            <div className={`${styles.resultBanner} ${selectedOption === question.correctOption ? styles.bannerCorrect : styles.bannerIncorrect}`}>
                                {selectedOption === question.correctOption ? '正解！' : '不正解...'}
                            </div>
                            <div className={styles.explanationBody}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath] as any}
                                    rehypePlugins={[rehypeKatex, rehypeRaw] as any}
                                    components={components}
                                >
                                    {question.explanation || '(解説がありません)'}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <footer className={styles.footer}>
                <Link href={`/exam/${year}/${type}`} className={styles.navBtn}>中断して一覧へ</Link>
                <button className={`${styles.navBtn} ${styles.primary}`} onClick={handleNext}>
                    {isMock ? '回答して次へ' : '次の問題へ'}
                </button>
            </footer>
        </div>
    );
}


