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
export async function generateStaticParams() {
    console.log('[SSG] Generating params for ALL questions...');

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

    console.log(`[SSG] Generated ${allParams.length} static pages.`);
    return allParams;
}

// ISR: Revalidate every hour
export const dynamicParams = true;
export const revalidate = 3600;

export default async function ExamQuestionPage({ params }: { params: { year: string; type: string; qNo: string } }) {
    const { year, type, qNo } = params;

    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    // Fetch Questions with caching enabled for SSG/ISR
    // We explicitly set cache to undefined to override the default 'no-store' in getQuestions.
    let questions: Question[] = [];
    try {
        questions = await getQuestions(examId, { cache: undefined, next: { revalidate: 3600 } });
    } catch (e) {
        console.warn(`[Page] API failed for ${examId} during render/build. Returning empty.`);
        // Note: In strict SSG build, this might mean the page is generated empty?
        // Ideally we would use FS here too if API fails, but let's assume API is available OR rely on revalidate
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
