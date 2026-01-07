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
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import { guestManager } from '@/lib/guest-manager';
import { useTheme } from '@/components/providers/ThemeProvider';
import { getExamLabel } from '@/lib/exam-utils';
import styles from './QuestionClient.module.css';
import { Question, saveLearningRecord, LearningRecord, getLearningRecords, saveExamProgress, getExamProgress } from '@/lib/api';
import { FaRegBookmark, FaBookmark } from 'react-icons/fa';

const Mermaid = dynamic(() => import('@/components/ui/Mermaid'), { ssr: false });
import ExamSummary from './ExamSummary';
import AIAnswerBox from './AIAnswerBox';
import SCPMExamView from './SCPMExamView';

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

    // Review Later State
    const [isBookmarked, setIsBookmarked] = useState(false);

    // Load history & progress on mount
    useEffect(() => {
        if (!session?.user?.id) return;

        async function fetchHistoryAndProgress() {
            try {
                const userId = session?.user?.id || guestManager.getGuestId();
                if (!userId) return;

                // 1. Fetch History (Logs)
                const records = await getLearningRecords(userId, question.examId);
                // ... (existing historyMap logic) ...
                const historyMap: Record<string, { answer: string; result: any }> = {};
                records.forEach(r => {
                    // ... existing logic ...
                    if (r.isDescriptive && r.userAnswer && r.questionId) {
                        historyMap[r.questionId] = {
                            answer: r.userAnswer,
                            result: {
                                score: r.aiScore || 0,
                                radarChartData: r.aiRadarData || [],
                                feedback: r.aiFeedback || '',
                                mermaidDiagram: undefined,
                            }
                        };
                    }
                });
                setDescriptiveHistory(historyMap);

                // 2. Fetch Progress (Bookmarks)
                const progress = await getExamProgress(userId, question.examId);
                if (progress && progress.bookmarks.includes(question.id)) {
                    setIsBookmarked(true);
                } else {
                    setIsBookmarked(false);
                }

            } catch (e) {
                console.error("Failed to load history/progress", e);
            }
        }
        fetchHistoryAndProgress();
    }, [question.id, session?.user?.id, question.examId]);

    // Handle Bookmark Toggle
    const toggleBookmark = async () => {
        const userId = session?.user?.id || guestManager.getGuestId();
        if (!userId) return;

        const newState = !isBookmarked;
        setIsBookmarked(newState); // Optimistic Update

        // Fetch current bookmarks to update list
        // Actually, creating a full list update might be race-condition prone if we don't have the full list.
        // API `saveExamProgress` expects the *new list* of bookmarks.
        // So we need to fetch, modify, save? Or should API handle toggle?
        // Proposal: Frontend maintains locally loaded bookmarks? No, we only loaded *this* question's state.
        // We need to fetch current progress first to get full list, then modify.
        // Or assume we fetched it in parent? We didn't.
        // Better Strategy: `saveExamProgress` should ideally accept "add/remove" or we fetch-modify-save.
        // Let's do fetch-modify-save for now.

        try {
            const current = await getExamProgress(userId, question.examId);
            let newBookmarks = current?.bookmarks || [];

            if (newState) {
                if (!newBookmarks.includes(question.id)) newBookmarks.push(question.id);
            } else {
                newBookmarks = newBookmarks.filter(id => id !== question.id);
            }

            await saveExamProgress(userId, question.examId, { bookmarks: newBookmarks });
        } catch (e) {
            console.error("Failed to save bookmark", e);
            setIsBookmarked(!newState); // Revert
        }
    };


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
                // [NEW] Sync Progress Snapshot immediately
                await saveExamProgress(session.user.id, question.examId, {
                    statusUpdate: { questionId: qId, isCorrect: (data.result.score || 0) >= 60 }
                });
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

        if (session && session.user?.id) {
            try {
                // Parallel Save: Log & Snapshot
                await Promise.all([
                    saveLearningRecord(record),
                    saveExamProgress(session.user.id, question.examId, {
                        statusUpdate: { questionId: question.id, isCorrect }
                    })
                ]);
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

    // --- SC/PM Exam View Injection (New Format) ---
    if (question.context) {
        return (
            <div className="flex flex-col h-screen overflow-hidden bg-background">
                {/* Optional: Keep minimal header or custom header for PM View */}
                <header className="flex-none h-16 border-b px-4 flex items-center justify-between bg-card text-foreground">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                            IpaLab
                        </Link>
                        <span className="text-sm font-medium text-muted-foreground border-l pl-4 border-gray-300 dark:border-gray-700">
                            {examLabel} {isMock ? '(模試モード)' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/exam/${year}/${type}`)}
                            className="text-sm px-4 py-2 rounded-md font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors shadow-sm"
                        >
                            終了して一覧へ
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden">
                    <SCPMExamView
                        question={question}
                        onAnswerSubmit={(subQIdx, answer) => {
                            // This might be for simple text input updates if needed, 
                            // but AIAnswerBox handles its own state mostly.
                        }}
                        onGrade={(data, subQIdx) => handleSaveAIScore(data, subQIdx as number)}
                        descriptiveHistory={descriptiveHistory}
                    />
                </div>
            </div>
        );
    }

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
            </div>
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
                    {/* Header Controls: Bookmark & Stats */}
                    <div className={styles.headerControls}>
                        {/* Bookmark Button */}
                        <button
                            className={`${styles.bookmarkBtn} ${isBookmarked ? styles.active : ''}`}
                            onClick={toggleBookmark}
                            title="あとで見直す"
                            aria-label="Review Later"
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.9rem',
                                color: isBookmarked ? '#f59e0b' : '#64748b',
                                marginRight: '1rem'
                            }}
                        >
                            {isBookmarked ? <FaBookmark /> : <FaRegBookmark />}
                            <span className={styles.mobileHidden}>
                                {isBookmarked ? '見直す' : 'あとで見直す'}
                            </span>
                        </button>

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

                    </div>
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
                    {/* Mermaid Diagram Injection for Issue #22 */}
                    {question.diagram && (
                        <div className="mt-6 mb-6 p-4 bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Diagram / Table</div>
                            <div className="overflow-x-auto">
                                <Mermaid chart={question.diagram.replace(/```mermaid/g, '').replace(/```/g, '')} />
                            </div>
                        </div>
                    )}
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


