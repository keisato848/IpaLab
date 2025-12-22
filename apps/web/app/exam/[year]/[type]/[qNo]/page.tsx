'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './page.module.css';

// Mock Data (matches standard Question structure)
const QUESTION_MOCK = {
    id: "q1",
    qNo: 1,
    text: `
### 問題

情報セキュリティマネジメントシステム(ISMS)の適合性評価制度において、認証機関が組織のISMSを認証する際の基準となる規格はどれか。

`,
    options: [
        { id: 'a', text: 'JIS Q 20000-1' },
        { id: 'b', text: 'JIS Q 27000' },
        { id: 'c', text: 'JIS Q 27001' },
        { id: 'd', text: 'JIS Q 27002' },
    ],
    correctOption: 'c',
    explanation: `
### 解説

**正解: ウ (JIS Q 27001)**

- **ア (JIS Q 20000-1):** ITサービスマネジメントシステム(ITSMS)の要求事項を規定した規格です。
- **イ (JIS Q 27000):** 情報セキュリティマネジメントシステム(ISMS)の用語及び定義を記述した規格です。
- **ウ (JIS Q 27001):** ISMS認証の基準となる要求事項を規定した規格です。組織がISMSを確立、実施、維持、継続的に改善するための要求事項が記載されています。
- **エ (JIS Q 27002):** 情報セキュリティ管理策の実践のための規範です。

したがって、認証の基準となる規格は **JIS Q 27001** です。
    `
};

export default function ExamQuestionPage({ params }: { params: { year: string; type: string; qNo: string } }) {
    const { year, type, qNo } = params;
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode') || 'practice';
    const router = useRouter();

    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);

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

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isPractice = mode === 'practice';
    const question = QUESTION_MOCK; // In real app, fetch based on qNo

    const handleOptionClick = (optionId: string) => {
        if (showExplanation && isPractice) return; // Prevent changing answer after showing explanation

        setSelectedOption(optionId);

        if (isPractice) {
            setShowExplanation(true);
        } else {
            // Mock Mode logic (Answer remains selected, but no feedback until end)
        }
    };

    const handleNext = () => {
        // Save answer logic would go here
        const nextQ = parseInt(qNo) + 1;
        router.push(`/exam/${year}/${type}/${nextQ}?mode=${mode}`);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.examInfo}>
                    <span className={styles.examBadge}>{type}</span>
                    <span className={styles.examTitle}>{year} - Q{qNo}</span>
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
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {question.text}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* Right: Options & Interaction */}
                <div className={styles.interactionPanel}>
                    <div className={styles.optionsList}>
                        {question.options.map((opt) => {
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
                                    {/* Show Icon ONLY in Practice Mode after answer */}
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
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {question.explanation}
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
