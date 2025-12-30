'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './QuestionClient.module.css';
import { Question, saveLearningRecord, LearningRecord } from '@/lib/api';
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
    }, [question.id]);

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
                return <Mermaid chart={String(children).replace(/\n$/, '')} />;
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

    if (isPM) {
        return (
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.examInfo}>
                        <span className={styles.examBadge}>{type}</span>
                        <span className={styles.examTitle}>{getExamLabel(year + (type.startsWith('PM') ? '-PM' : '-AM'))} - Q{qNo} (記述式)</span>
                    </div>
                    <div className={styles.meta}>
                        <Link href={`/exam/${year}/${type}`} className={styles.navBtn}>一覧へ戻る</Link>
                    </div>
                </header>

                <div className={`${styles.content} flex flex-col lg:flex-row gap-6 p-4`}>
                    {/* Top/Left: Case Study Description */}
                    <div className="flex-1 bg-white p-6 rounded shadow overflow-y-auto max-h-[80vh]">
                        <h2 className="text-xl font-bold mb-4">{question.subCategory || '問題文'}</h2>
                        <div className={styles.markdownBody}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                                {question.text}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {/* Bottom/Right: Sub Questions */}
                    <div className="flex-1 bg-gray-50 p-6 rounded shadow overflow-y-auto max-h-[80vh]">
                        <h3 className="text-lg font-bold mb-4">設問</h3>
                        {question.subQuestions?.map((subQ: any, index: number) => (
                            <div key={index} className="mb-6 border-b pb-4 last:border-0">
                                <h4 className="font-bold text-md mb-2">{subQ.subQNo}</h4>
                                <div className="mb-2 text-gray-800">{subQ.text}</div>
                                {subQ.subQuestions?.map((sq: any, sIdx: number) => (
                                    <div key={sIdx} className="ml-4 mt-2 p-2 bg-white rounded border">
                                        <span className="font-semibold mr-2">{sq.label}</span>
                                        <span>{sq.text}</span>
                                    </div>
                                ))}
                            </div>
                        ))}

                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                            ※ 午後試験は記述式のため、現在は閲覧のみ対応しています。ノート機能などを今後追加予定です。
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
