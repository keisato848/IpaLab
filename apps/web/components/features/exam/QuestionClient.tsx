'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Question, saveLearningRecord, LearningRecord, getLearningRecords, saveExamProgress, getExamProgress, updateSessionProgress } from '@/lib/api';
import { FaRegBookmark, FaBookmark } from 'react-icons/fa';

// Helper: Check if answer is correct (supports ALL_CORRECT for questions with no valid answer)
const checkIsCorrect = (selectedOption: string | null, correctOption: string): boolean => {
    if (!selectedOption) return false;
    if (correctOption === 'ALL_CORRECT') return true; // 出題誤り等で全員正解
    return selectedOption === correctOption;
};

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
    const sessionId = searchParams.get('sessionId'); // [NEW] Get Session ID
    const isReview = searchParams.get('review') === 'true';
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

    // Stats version counter to protect optimistic updates from stale server data.
    // 非同期で統計データをフェッチ／保存するたびにバージョン番号をインクリメントし、
    // フェッチ開始時点のバージョン（例: fetchVersion）と完了時点の statsVersionRef.current を比較することで、
    // フェッチ中に save 処理などでより新しいバージョンに更新されていた場合は、
    // その古いフェッチ結果で最新の状態を上書きしないようにする。
    const statsVersionRef = useRef(0);

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
    // [NEW] Session Flag State
    const [isFlagged, setIsFlagged] = useState(false);
    // Guest Warning State (show only on first answer)
    const [showGuestWarning, setShowGuestWarning] = useState(false);
    // [NEW] Progress dropdown state (mobile)
    const [showProgressDropdown, setShowProgressDropdown] = useState(false);
    // [NEW] Session finishing state
    const [isFinishing, setIsFinishing] = useState(false);

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

                // 3. Restore Flag State (if in same session)
                if (sessionId) {
                    // Filter records for this session and question
                    const sessionRecord = records.find(r => r.sessionId === sessionId && r.questionId === question.id);
                    if (sessionRecord?.isFlagged) {
                        setIsFlagged(true);
                    }
                }

            } catch (e) {
                console.error("Failed to load history/progress", e);
            }
        }
        fetchHistoryAndProgress();
    }, [question.id, session?.user?.id, question.examId, sessionId]);

    // Handle Bookmark Toggle
    const toggleBookmark = async () => {
        const userId = session?.user?.id || guestManager.getGuestId();
        if (!userId) return;

        const newState = !isBookmarked;
        setIsBookmarked(newState); // Optimistic Update

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

    // [NEW] Toggle Flag Logic
    const toggleFlag = () => {
        const newState = !isFlagged;
        setIsFlagged(newState);
        // Note: Flags are typically saved with the record. 
        // If we want to persist "Flag only" without answering, we might need a special record type or update logic.
        // For now, we'll assume flags are attached to the answer attempt or saved when navigating?
        // OR, simply save a "Flag Update" record?
        // Simpler approach: Just local state until Answer.
        // BUT user might "Flag and Skip".
        // If "Flag and Skip", we should probably save a record with `answeredAt` but maybe `isSkipped: true` or just `isFlagged: true`.
        // Let's autosave if sessionId exists.
        if (sessionId) {
            // Background save for flag state
            const record: LearningRecord = {
                id: uuidv4(),
                userId: session?.user?.id || guestManager.getGuestId() || 'anonymous',
                questionId: question.id,
                examId: question.examId,
                category: question.category,
                subCategory: question.subCategory,
                isCorrect: false, // Default if just flagging
                isFlagged: newState,
                sessionId,
                answeredAt: new Date().toISOString(),
                timeTakenSeconds: 0,
            };
            saveLearningRecord(record).catch(e => console.error("Failed to save flag", e));
        }
    };


    // Reset state when question changes (reviewモード時は解答・解説を復元)
    useEffect(() => {
        setSelectedOption(isReview ? question.correctOption : null);
        setShowExplanation(isReview);
        setIsFlagged(false); // Reset Flag
        setStartTime(Date.now());

        // Fetch Past Stats (Current Question) & Exam Stats (Current Exam)
        async function fetchStats() {
            try {
                const userId = session?.user?.id || guestManager.getGuestId();
                if (!userId) return;

                // Capture version before async fetch to detect concurrent saves
                const fetchVersion = statsVersionRef.current;

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

                // Skip overwriting stats if a save occurred during this fetch (race condition protection)
                if (fetchVersion !== statsVersionRef.current) return;

                if (eRecords.length > 0) {
                    setAllExamRecords(eRecords);
                    // Session Stats (Today's records)
                    const today = new Date().toISOString().split('T')[0];
                    const todaysRecords = eRecords.filter(r => r && r.answeredAt && r.answeredAt.startsWith(today));
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
    }, [question.id, question.examId, question.correctOption, isReview, session]);

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
        const isCorrect = (data.result.score || 0) >= 60;
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
            isCorrect,
            answeredAt: new Date().toISOString(),
            timeTakenSeconds: 0,
        };

        // Optimistic UI update (before API calls to ensure immediate feedback)
        statsVersionRef.current += 1;
        setSessionStats(prev => ({
            total: prev.total + 1,
            correct: prev.correct + (isCorrect ? 1 : 0)
        }));
        setExamStats(prev => {
            const currentTotal = prev?.total || 0;
            const currentCorrect = prev?.correct || 0;
            return {
                total: currentTotal + 1,
                correct: currentCorrect + (isCorrect ? 1 : 0)
            };
        });

        try {
            if (session?.user?.id) {
                // Save record and progress
                const savePromises: Promise<any>[] = [
                    saveLearningRecord(record),
                    saveExamProgress(session.user.id, question.examId, {
                        statusUpdate: { questionId: qId, isCorrect }
                    })
                ];

                // Update session progress if sessionId exists
                if (sessionId) {
                    const newTotal = sessionStats.total + 1;
                    const newCorrect = sessionStats.correct + (isCorrect ? 1 : 0);
                    savePromises.push(
                        updateSessionProgress(sessionId, {
                            answeredCount: newTotal,
                            correctCount: newCorrect,
                            lastQuestionNo: parseInt(qNo),
                        })
                    );
                }

                await Promise.all(savePromises);
            } else {
                // Guest mode: show warning on first answer only
                if (!guestManager.hasShownWarning()) {
                    setShowGuestWarning(true);
                    guestManager.markWarningShown();
                }
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
        const isCorrect = checkIsCorrect(optionId, question.correctOption);
        const timeTaken = Math.floor((Date.now() - startTime) / 1000);

        const record: LearningRecord = {
            id: uuidv4(),
            userId: session?.user?.id || guestManager.getGuestId() || 'anonymous',
            questionId: question.id,
            examId: question.examId,
            category: question.category,
            subCategory: question.subCategory,
            isCorrect,
            isFlagged, // [NEW]
            sessionId: sessionId || undefined, // [NEW]
            answeredAt: new Date().toISOString(),
            timeTakenSeconds: timeTaken,
        };

        // Optimistic UI update (before API calls to ensure immediate feedback)
        statsVersionRef.current += 1;
        setSessionStats(prev => ({
            total: prev.total + 1,
            correct: prev.correct + (isCorrect ? 1 : 0)
        }));
        setExamStats(prev => {
            const currentTotal = prev?.total || 0;
            const currentCorrect = prev?.correct || 0;
            return {
                total: currentTotal + 1,
                correct: currentCorrect + (isCorrect ? 1 : 0)
            };
        });

        if (session && session.user?.id) {
            try {
                // Parallel Save: Log & Snapshot & Session Progress
                const savePromises: Promise<any>[] = [
                    saveLearningRecord(record),
                    saveExamProgress(session.user.id, question.examId, {
                        statusUpdate: { questionId: question.id, isCorrect }
                    })
                ];

                // Update session progress if sessionId exists
                if (sessionId) {
                    const newTotal = sessionStats.total + 1;
                    const newCorrect = sessionStats.correct + (isCorrect ? 1 : 0);
                    savePromises.push(
                        updateSessionProgress(sessionId, {
                            answeredCount: newTotal,
                            correctCount: newCorrect,
                            lastQuestionNo: parseInt(qNo),
                        })
                    );
                }

                await Promise.all(savePromises);
            } catch (e) {
                console.error("Failed to save to API", e);
            }
        } else {
            // Guest mode: show warning on first answer only
            if (!guestManager.hasShownWarning()) {
                setShowGuestWarning(true);
                guestManager.markWarningShown();
            }
            guestManager.saveHistory(record);
        }
    };

    const handleNext = async () => {
        const currentInt = parseInt(qNo);

        // モック試験モードでは次の問題へ進む前に解答を保存する
        // （handleOptionClickではisPractice時のみsaveResultを呼ぶため、モック時はここで保存）
        if (isMock && selectedOption) {
            await saveResult(selectedOption);
        }

        if (currentInt < totalQuestions) {
            const nextQ = currentInt + 1;
            router.push(`/exam/${year}/${type}/${nextQ}?mode=${mode}${sessionId ? `&sessionId=${sessionId}` : ''}`);
        } else {
            router.push(`/exam/${year}/${type}/result?mode=${mode}${sessionId ? `&sessionId=${sessionId}` : ''}`);
        }
    };

    // Session action handlers
    const handleFinishSession = async () => {
        if (!sessionId || !session?.user?.id) {
            // For guests, just go to result
            router.push(`/exam/${year}/${type}/result?mode=${mode}`);
            return;
        }
        
        try {
            await updateSessionProgress(sessionId, {
                status: 'completed',
                answeredCount: sessionStats.total,
                correctCount: sessionStats.correct,
                lastQuestionNo: parseInt(qNo)
            });
            router.push(`/exam/${year}/${type}/result?mode=${mode}&sessionId=${sessionId}`);
        } catch (err) {
            console.error('Failed to finish session', err);
            router.push(`/exam/${year}/${type}/result?mode=${mode}&sessionId=${sessionId}`);
        }
    };

    const handleRestartSession = async () => {
        setShowProgressDropdown(false);
        const userId = session?.user?.id || guestManager.getGuestId();
        if (!userId) {
            router.push('/login');
            return;
        }

        if (session?.user?.id) {
            try {
                const { createLearningSession } = await import('@/lib/api');
                const newSession = await createLearningSession(userId, examId, mode as 'practice' | 'mock', totalQuestions);
                router.push(`/exam/${year}/${type}/1?mode=${mode}&sessionId=${newSession?.id || ''}`);
            } catch (err) {
                console.error('Failed to create new session', err);
                router.push(`/exam/${year}/${type}/1?mode=${mode}`);
            }
        } else {
            router.push(`/exam/${year}/${type}/1?mode=${mode}`);
        }
    };

    // Construct Exam ID safely
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;
    const examLabel = getExamLabel(examId);

    // AM2（午前II）は全問四択なので、optionsがある場合はPM扱いしない
    const hasOptions = question.options && question.options.length > 0;
    const isPM = question.isPM || type.includes('PM') || (type === 'AM2' && !hasOptions && (question.subQuestions && question.subQuestions.length > 0));

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

                {/* Guest Warning - show only on first answer */}
                {showGuestWarning && !session?.user && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', padding: '0.5rem 1rem', fontSize: '0.85rem', textAlign: 'center', position: 'relative' }}>
                        ⚠️ ゲストモード：履歴はブラウザに保存され、キャッシュクリア等で消失します。<Link href="/login" style={{ textDecoration: 'underline', fontWeight: 'bold' }}>ログイン</Link>してデータを守りましょう。
                        <button onClick={() => setShowGuestWarning(false)} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#92400e' }}>✕</button>
                    </div>
                )}

                <div className={styles.pmGrid}>
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
                {/* Row 1: Exam info + Mode + Controls */}
                <div className={styles.headerRow1}>
                    <div className={styles.examInfo}>
                        <span className={`${styles.examBadge} ${styles.mobileHidden}`}>{type}</span>
                        <span className={styles.examTitle}>
                            <span className={styles.mobileHidden}>{examLabel} - </span>
                            Q{qNo}
                        </span>
                        <span className={`${styles.modeBadge} ${isMock ? styles.mockBadge : ''} ${styles.mobileHidden}`}>
                            {isPractice ? '練習' : '模試'}
                        </span>
                    </div>

                    {/* Controls: Flag, Bookmark */}
                    <div className={styles.headerControls}>
                        <button
                            className={`${styles.bookmarkBtn} ${isFlagged ? styles.active : ''}`}
                            onClick={toggleFlag}
                            title="このセッションで見直す"
                        >
                            <span>{isFlagged ? '🚩' : '🏳️'}</span>
                            <span className={styles.mobileHidden}>{isFlagged ? '見直し' : '見直す'}</span>
                        </button>

                        <button
                            className={`${styles.bookmarkBtn} ${isBookmarked ? styles.active : ''}`}
                            onClick={toggleBookmark}
                            title="永久ブックマーク"
                        >
                            {isBookmarked ? <FaBookmark /> : <FaRegBookmark />}
                            <span className={styles.mobileHidden}>保存</span>
                        </button>
                    </div>
                </div>

                {/* Row 2: Progress bar + Stats + Session Actions */}
                {isPractice && (
                    <div className={styles.headerRow2}>
                        {/* Progress section - clickable on mobile */}
                        <div 
                            className={styles.progressContainer}
                            onClick={() => setShowProgressDropdown(!showProgressDropdown)}
                        >
                            <div className={styles.progressBar}>
                                <div 
                                    className={styles.progressFill}
                                    style={{ width: `${(parseInt(qNo) / totalQuestions) * 100}%` }}
                                />
                            </div>
                            <span className={styles.progressText}>
                                {qNo}/{totalQuestions}
                            </span>
                            {/* Mobile dropdown indicator */}
                            <span className={styles.mobileOnly} style={{ marginLeft: '0.25rem' }}>
                                {showProgressDropdown ? '▲' : '▼'}
                            </span>
                        </div>

                        {/* Desktop: inline stats */}
                        {showExamStats && (
                            <div className={`${styles.statsContainer} ${styles.mobileHidden}`}>
                                {sessionStats.total > 0 && (
                                    <span className={styles.statItem}>
                                        今回: {Math.round((sessionStats.correct / sessionStats.total) * 100)}%
                                    </span>
                                )}
                                {examStats && examStats.total > 0 && (
                                    <span className={styles.statItem}>
                                        通算: {Math.round((examStats.correct / examStats.total) * 100)}%
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Desktop: Session action buttons */}
                        <div className={`${styles.sessionActions} ${styles.mobileHidden}`}>
                            <button 
                                className={`${styles.sessionActionBtn} ${styles.finish}`}
                                onClick={handleFinishSession}
                            >
                                採点終了
                            </button>
                            <button 
                                className={styles.sessionActionBtn}
                                onClick={handleRestartSession}
                            >
                                やり直し
                            </button>
                            <Link 
                                href={`/exam/${year}/${type}`}
                                className={styles.sessionActionBtn}
                            >
                                一覧
                            </Link>
                        </div>

                        {/* Mobile: Progress dropdown menu */}
                        {showProgressDropdown && (
                            <div className={styles.progressDropdown}>
                                <div className={styles.dropdownStats}>
                                    <div className={styles.dropdownStat}>
                                        <div className={styles.dropdownStatValue}>{sessionStats.correct}</div>
                                        <div className={styles.dropdownStatLabel}>正解</div>
                                    </div>
                                    <div className={styles.dropdownStat}>
                                        <div className={styles.dropdownStatValue}>{sessionStats.total - sessionStats.correct}</div>
                                        <div className={styles.dropdownStatLabel}>不正解</div>
                                    </div>
                                    <div className={styles.dropdownStat}>
                                        <div className={styles.dropdownStatValue}>
                                            {sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}%
                                        </div>
                                        <div className={styles.dropdownStatLabel}>正答率</div>
                                    </div>
                                </div>
                                <div className={styles.dropdownActions}>
                                    <button 
                                        className={`${styles.dropdownBtn} ${styles.warning}`}
                                        onClick={handleFinishSession}
                                    >
                                        採点して終了
                                    </button>
                                    <button 
                                        className={styles.dropdownBtn}
                                        onClick={handleRestartSession}
                                    >
                                        最初からやり直す
                                    </button>
                                    <Link 
                                        href={`/exam/${year}/${type}`}
                                        className={styles.dropdownBtn}
                                        onClick={() => setShowProgressDropdown(false)}
                                    >
                                        問題一覧
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Mock mode: Timer only */}
                {isMock && (
                    <div className={styles.headerRow2}>
                        <span className={styles.timer}>
                            ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                        </span>
                    </div>
                )}
            </header>

            {/* Guest Warning - show only on first answer */}
            {showGuestWarning && !session?.user && (
                <div style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d', color: '#92400e', padding: '0.5rem 1rem', fontSize: '0.85rem', textAlign: 'center', position: 'relative' }}>
                    ⚠️ ゲストモード：履歴はブラウザに保存され、キャッシュクリア等で消失します。<Link href="/login" style={{ textDecoration: 'underline', fontWeight: 'bold', marginLeft: '0.5rem' }}>ログイン</Link>してデータを守りましょう。
                    <button onClick={() => setShowGuestWarning(false)} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#92400e' }}>✕</button>
                </div>
            )}

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
                            const isCorrect = checkIsCorrect(opt.id, question.correctOption);

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
                            <div className={`${styles.resultBanner} ${checkIsCorrect(selectedOption, question.correctOption) ? styles.bannerCorrect : styles.bannerIncorrect}`}>
                                {checkIsCorrect(selectedOption, question.correctOption) ? '正解！' : '不正解...'}
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


