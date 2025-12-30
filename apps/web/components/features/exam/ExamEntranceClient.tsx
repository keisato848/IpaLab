'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { guestManager } from '@/lib/guest-manager';
import { getLearningRecords, LearningRecord, Question } from '@/lib/api';
import styles from '@/app/(main)/exam/[year]/[type]/page.module.css'; // Import from parent page styles or duplicate/move

interface ExamEntranceClientProps {
    year: string;
    type: string;
    examId: string;
    examLabel: string;
    questions: Question[];
}

export default function ExamEntranceClient({ year, type, examId, examLabel, questions }: ExamEntranceClientProps) {
    const { data: session } = useSession();
    const [nextQNo, setNextQNo] = useState<number>(1);
    const [progress, setProgress] = useState<{ completed: number, total: number }>({ completed: 0, total: questions.length });
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        async function fetchProgress() {
            const userId = session?.user?.id || guestManager.getGuestId();
            if (!userId) {
                setIsLoaded(true);
                return;
            };

            try {
                const records = await getLearningRecords(userId, examId);
                // Filter for this exam is already done by API, but double check
                const correctCount = records.filter(r => r.isCorrect).length; // or just completed count?
                // Unique questions answered
                const answeredQIds = new Set(records.map(r => r.questionId));

                // Find max answered qNo
                // Assuming question IDs are like 'AP-2024-Spring-AM-1'
                // But better to map based on 'questions' array passed in.
                // We want the first UNANSWERED question, or the one after the last answered one.
                // Usually "Resume" means "Next unattempted".

                // Let's sort questions by qNo
                // Identify first q where !answeredQIds.has(q.id)
                // Actually 'records' store qId.

                let firstUnanswered: number = 1;
                for (const q of questions) {
                    // Check if there is a record for this question
                    // Note: multiple attempts possible, so we check existence
                    const hasRecord = answeredQIds.has(q.id);
                    if (!hasRecord) {
                        firstUnanswered = q.qNo;
                        break;
                    }
                    firstUnanswered = q.qNo + 1; // If all checked so far are answered, next is +1
                }

                // Cap at total
                if (firstUnanswered > questions.length) firstUnanswered = 1; // Or finished? User might want to review. 
                // If finished, maybe Q1 is fine, or random? Let's default to Q1 but show 100%.

                if (answeredQIds.size === questions.length) {
                    // All done
                    firstUnanswered = 1;
                }

                setNextQNo(firstUnanswered);
                setProgress({ completed: answeredQIds.size, total: questions.length });
            } catch (e) {
                console.error("Failed to fetch progress", e);
            } finally {
                setIsLoaded(true);
            }
        }

        fetchProgress();
    }, [session, examId, questions]);

    const btnText = (progress.completed > 0 && progress.completed < progress.total)
        ? `続きから開始 (Q${nextQNo})`
        : "練習モードで開始";

    const linkHref = `/exam/${year}/${type}/${nextQNo}?mode=practice`;

    const mockSettings = (() => {
        if (type === 'AM2') return { time: 40, count: questions.length }; // AM2 is usually 25q, 40min
        if (type.includes('PM')) return { time: 150, count: questions.length }; // PM is 150min
        return { time: 150, count: 80 }; // Default AM1
    })();

    const displayCount = questions.length > 0 ? questions.length : mockSettings.count;

    return (
        <div className={styles.container}>
            <div className={styles.breadcrumb}>
                <Link href="/exam">演習一覧</Link> &gt; {examLabel}
            </div>

            <header className={styles.header}>
                <h1>{examLabel}</h1>
                <p className={styles.description}>
                    モードを選択して開始してください。
                    <br />
                    練習モードでは一問ごとに正誤を確認できます。
                </p>
                <div className={styles.actions}>
                    <Link href={linkHref} className={`${styles.btn} ${styles.btnPractice}`}>
                        {isLoaded ? btnText : "読み込み中..."}
                        <span className={styles.btnSub}>即座に解説を表示</span>
                    </Link>
                    <Link href={`/exam/${year}/${type}/1?mode=mock`} className={`${styles.btn} ${styles.btnMock}`}>
                        模擬試験モードで開始
                        <span className={styles.btnSub}>{mockSettings.time}分 / {displayCount}問</span>
                    </Link>
                </div>
            </header>

            <section className={styles.questionList}>
                <h2>問題一覧 ({questions.length}問)</h2>
                {questions.length === 0 ? (
                    <p className={styles.noData}>
                        問題データが見つかりません。<br />
                        バックエンドAPIが起動しているか、examId ({examId}) が正しいか確認してください。
                    </p>
                ) : (
                    <div className={styles.grid}>
                        {questions.map(q => (
                            <Link href={`/exam/${year}/${type}/${q.qNo}?mode=practice`} key={q.id} className={`${styles.qItem}`}>
                                <div className={styles.qHeader}>
                                    <span className={styles.qNo}>Q{q.qNo}</span>
                                    <span className={styles.qCat}>{q.subCategory || q.category}</span>
                                </div>
                                <p className={styles.qSummary}>{q.text.substring(0, 40)}...</p>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
