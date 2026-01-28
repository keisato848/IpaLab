// Rebuild Trigger (Fixed)
import Link from 'next/link';
import { getQuestions, Question } from '@/lib/api';
import { getExamData } from '@/lib/ssg-helper';
import QuestionClient from '@/components/features/exam/QuestionClient';
import styles from './page.module.css';
import { Suspense } from 'react';
import { questionRepository } from '@/lib/repositories/questionRepository';

// Disable SSG, use SSR/ISR
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 3600;

import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { year: string; type: string; qNo: string } }): Promise<Metadata> {
    const { year, type, qNo } = params;
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    try {
        const questions = await questionRepository.listByExamId(examId);
        const question = questions.find((q: any) => q.qNo === parseInt(qNo));

        if (!question) return { title: `Not Found - IpaLab` };

        // Safe substring for description
        const desc = question.text ? question.text.substring(0, 120).replace(/\n/g, ' ') + '...' : `情報処理技術者試験 ${year} ${type} 問${qNo}`;

        return {
            title: `Q${qNo} ${year} ${type} - IpaLab 過去問道場`,
            description: desc,
            openGraph: {
                title: `Q${qNo} ${year} ${type} (正答率: --%) - IpaLab`,
                description: desc,
            }
        };
    } catch {
        return { title: `IpaLab Exam Question` };
    }
}

export default async function ExamQuestionPage({ params }: { params: { year: string; type: string; qNo: string } }) {
    const { year, type, qNo } = params;

    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    // Fetch Questions
    let questions: Question[] = [];
    try {
        // Build Optimization: Use DB directly
        const data = await questionRepository.listByExamId(examId);
        questions = data as unknown as Question[];
    } catch (e) {
        // console.warn(`[Page] Data load failed for ${examId}.`);
    }

    // Fallback to Filesystem (for local dev without DB)
    if (questions.length === 0) {
        try {
            const fsData = await getExamData(examId);
            // Handle { questions: [...] } structure from raw JSON
            if (fsData && !Array.isArray(fsData) && 'questions' in fsData) {
                questions = (fsData as any).questions as Question[];
            } else if (Array.isArray(fsData)) {
                questions = fsData as unknown as Question[];
            }
        } catch (e) {
            console.warn(`[Page] FS Data load failed for ${examId}.`);
        }
    }

    // Find current question by qNo
    const qNoInt = parseInt(qNo);
    const question = questions.find(q => q.qNo === qNoInt);

    if (!question) {
        return (
            <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1>問題が見つかりません (Q{qNo})</h1>
                    <p>番号が正しいか確認してください。</p>
                    <Link href={`/exam/${year}/${type}`} style={{ color: '#0070f3', textDecoration: 'underline' }}>
                        問題一覧に戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading Question Interface...</div>}>
            <QuestionClient
                question={question}
                year={year}
                type={type}
                qNo={qNo}
                totalQuestions={questions.length}
            />
        </Suspense>
    );
}