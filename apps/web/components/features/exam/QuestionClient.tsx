'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
// @ts-ignore
import he from 'he';
import styles from './QuestionClient.module.css';
import { Question, saveLearningRecord, LearningRecord, getLearningRecords } from '@/lib/api';
import { guestManager } from '@/lib/guest-manager';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import { getExamLabel } from '@/lib/exam-utils';
import dynamic from 'next/dynamic';

const Mermaid = dynamic(() => import('@/components/ui/Mermaid'), { ssr: false });

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

    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [startTime, setStartTime] = useState<number>(Date.now());

    // Stats State
    const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });
    const [pastStats, setPastStats] = useState<{ total: number; correct: number } | null>(null);

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

    // Reset state when question changes
    useEffect(() => {
        setSelectedOption(null);
        setShowExplanation(false);
        setStartTime(Date.now());

        // Fetch Past Stats
        async function fetchPastStats() {
            try {
                const userId = session?.user?.id || guestManager.getGuestId();
                if (!userId) return;

                // Use the updated API that filters by questionId
                const records = await getLearningRecords(userId, undefined, question.id);
                if (records.length > 0) {
                    const correctCount = records.filter(r => r.isCorrect).length;
                    setPastStats({ total: records.length, correct: correctCount });
                } else {
                    setPastStats(null);
                }
            } catch (e) {
                console.error("Failed to fetch past stats", e);
            }
        }
        fetchPastStats();
    }, [question.id, session]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isPractice = mode === 'practice';

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
            // Logged in user -> API
            try {
                await saveLearningRecord(record);
            } catch (e) {
                console.error("Failed to save to API", e);
            }
        } else {
            // Guest -> LocalStorage
            guestManager.saveHistory(record);
        }

        // Update Session Stats
        setSessionStats(prev => ({
            total: prev.total + 1,
            correct: prev.correct + (isCorrect ? 1 : 0)
        }));
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
                // Decode HTML entities that might have been escaped by rehype-raw
                // Mermaid needs raw characters like (>), (<), (&)
                const rawChildren = String(children);
                const chartContent = he.decode(rawChildren).replace(/\n$/, '');

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

    if (isPM) {
        // Flatten subQuestions if nested, or use direct list.
        // Data structure seems to be: question.subQuestions = [ { subQNo: '設問1', text: '...', subQuestions: [...] }, ... ]
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

        return (
            <div className={styles.pmContainer}>
                <header className={styles.pmHeader}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className={styles.examInfo}>
                            <span className={styles.examBadge}>{type}</span>
                            <span className={styles.examTitle}>{getExamLabel(year + (type.startsWith('PM') ? '-PM' : '-AM'))} - Q{qNo} (記述式)</span>
                        </div>
                        <div className={styles.navBtnGroup}>
                            <button
                                onClick={handleSubPrev}
                                disabled={currentSubQIndex === 0}
                                className={`${styles.navBtn} ${currentSubQIndex === 0 ? styles.navBtnDisabled : ''}`}
                            >
                                &larr; 前の設問
                            </button>
                            <span style={{ fontWeight: 'bold', minWidth: '80px', textAlign: 'center' }}>設問 {currentSubQIndex + 1} / {subQs.length}</span>
                            <button
                                onClick={handleSubNext}
                                disabled={currentSubQIndex === subQs.length - 1}
                                className={`${styles.navBtn} ${currentSubQIndex === subQs.length - 1 ? styles.navBtnDisabled : ''}`}
                            >
                                次の設問 &rarr;
                            </button>
                            <Link href={`/exam/${year}/${type}`} className={styles.navBtn} style={{ marginLeft: '1rem' }}>一覧へ戻る</Link>
                        </div>
                    </div>
                </header>

                <div className={styles.pmContent}>
                    {/* Top/Left: Case Study Description */}
                    <div className={styles.pmPanel}>
                        <h2 className={styles.pmPanelTitle}>{question.subCategory || '問題文'}</h2>
                        <div className={styles.markdownBody}>
                            {/* @ts-ignore */}
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
                                {question.text}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {/* Bottom/Right: Sub Questions (Stepper View) */}
                    <div className={styles.pmPanel}>
                        {currentSubQ ? (
                            <div>
                                <h3 className={styles.pmPanelTitle}>
                                    {currentSubQ.subQNo || `設問 ${currentSubQIndex + 1}`}
                                </h3>
                                <div className={styles.subQText} style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                                    {currentSubQ.text}
                                </div>
                                {currentSubQ.subQuestions?.map((sq: any, sIdx: number) => (
                                    <div key={sIdx} className={styles.subQBox}>
                                        <div className={styles.subQLabel}>{sq.label}</div>
                                        <div className={styles.subQText}>{sq.text}</div>
                                        <textarea
                                            className={styles.memoArea}
                                            rows={3}
                                            placeholder="回答メモ（一時保存用）"
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 mt-10">設問データがありません</div>
                        )}

                        <div style={{ marginTop: '2rem', padding: '1rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', color: '#92400e', fontSize: '0.9rem' }}>
                            ※ 午後試験モード: 現在は閲覧とメモ書きのみ対応しています。
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.examInfo}>
                    <span className={styles.examBadge}>{type}</span>
                    <span className={styles.examTitle}>{examLabel} - Q{qNo}</span>
                </div>
                <div className={styles.meta}>
                    <span className={`${styles.modeBadge} ${isMock ? styles.mockBadge : ''}`}>
                        {isPractice ? '練習モード' : '模擬試験モード'}
                    </span>
                    {isPractice && sessionStats.total > 0 && (
                        <span className={styles.modeBadge} style={{ background: '#e0f2fe', color: '#0369a1', marginLeft: '0.5rem' }}>
                            正答率: {Math.round((sessionStats.correct / sessionStats.total) * 100)}% ({sessionStats.correct}/{sessionStats.total})
                        </span>
                    )}
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
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
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
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
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
