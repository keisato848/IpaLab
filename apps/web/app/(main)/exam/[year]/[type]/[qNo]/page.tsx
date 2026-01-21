// Rebuild Trigger (Fixed)
import Link from 'next/link';
import { getQuestions, Question } from '@/lib/api';
import QuestionClient from '@/components/features/exam/QuestionClient';
import styles from './page.module.css';
import { Suspense } from 'react';
import fs from 'fs/promises';
import path from 'path';

import { generateAllExamParams, getExamDataFS } from '@/lib/ssg-helper';

// Enable SSG for ALL exams
/*
export async function generateStaticParams() {
    // console.log('[SSG] Generating params for ALL questions...');

    // 1. Get all exams
    const examParams = await generateAllExamParams();
    let allParams: { year: string; type: string; qNo: string }[] = [];

    // 2. Iterate and get questions for each (Chunking might be needed if too large, but start simple)
    // Note: This effectively reads thousands of files during build. That's fine for FS.
    for (const exam of examParams) {
        const questions = await getExamDataFS(exam.examId);

        const qParams = questions.map((q, idx) => ({
            year: exam.year,
            type: exam.type,
            qNo: (q.qNo !== undefined ? q.qNo : (idx + 1)).toString()
        }));

        allParams = allParams.concat(qParams);
    }

    // console.log(`[SSG] Generated ${allParams.length} static pages.`);
    return allParams;
}
*/

// ISR: Revalidate every hour
export const dynamicParams = true;
export const revalidate = 3600;

import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { year: string; type: string; qNo: string } }): Promise<Metadata> {
    const { year, type, qNo } = params;
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    try {
        const questions = await getExamDataFS(examId);
        const question = questions.find(q => q.qNo === parseInt(qNo));

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
        // Build Optimization: Use FS directly
        const fsData = await getExamDataFS(examId);
        questions = fsData as unknown as Question[];
    } catch (e) {
        // console.warn(`[Page] Data load failed for ${examId}.`);
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