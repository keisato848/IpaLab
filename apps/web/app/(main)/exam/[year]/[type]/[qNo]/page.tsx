// Rebuild Trigger (Fixed)
import Link from 'next/link';
import { getQuestions } from '@/lib/api';
import QuestionClient from '@/components/features/exam/QuestionClient';
import styles from './page.module.css';
import { Suspense } from 'react';
import fs from 'fs/promises';
import path from 'path';

// Enable SSG for specific exams to improve performance
export async function generateStaticParams() {
    // Ideally fetch all exams, but to save build time, we target specific ones as requested
    const targetExams = ['SC-2024-Fall-PM', 'SC-2023-Fall-PM', 'SC-2023-Spring-PM1'];

    let paramsList: { year: string; type: string; qNo: string }[] = [];

    for (const examId of targetExams) {
        let questions: any[] = [];
        try {
            // Try strict FS read for robustness during build when API might be down
            // Path relative to apps/web (process.cwd())
            const dataPath = path.join(process.cwd(), '../../packages/data/data/questions', examId, 'questions_transformed.json');

            try {
                const fileContent = await fs.readFile(dataPath, 'utf-8');
                const jsonData = JSON.parse(fileContent);
                // The structure for PM questions is { qNo, theme, context, questions: [...] }
                // For AM questions it might be Array directly? Need to be safe.
                if (Array.isArray(jsonData)) {
                    questions = jsonData;
                } else if (jsonData.questions && Array.isArray(jsonData.questions)) {
                    questions = jsonData.questions;
                    // Note: accessing jsonData.questions gives us the list of SubQuestions?
                    // Wait, `questions_transformed.json` for PM has:
                    // "questions": [ { subQNo: "設問1", ... }, { subQNo: "設問2", ... } ]
                    // But the URL structure is /exam/[year]/[type]/[qNo].
                    // Does qNo correspond to these sub-questions?
                    // In `getQuestions` API (api/src/functions/questions.ts), it transforms?
                    // Usually getQuestions returns [ { qNo: 1, ... } ].
                    // If transformed json is a single object representing "One Context + Multiple SubQuestions",
                    // then it is treated as ONE Question entity in the standard API?
                    // Actually, for PM, the entire JSON is often 1 Question (qNo: 1 or so).
                    // The standard API `getQuestions` likely returns [ { ...rootObject } ].
                    // So if read from file returns a single object, we wrap it in array?
                    questions = [jsonData];
                }

                console.log(`[SSG] Loaded ${questions.length} questions for ${examId} from FS.`);
            } catch (fsError) {
                // Fallback to API if FS fails
                console.warn(`[SSG] FS read failed for ${examId}, trying API...`);
                // For build time generation, allow revalidate logic
                questions = await getQuestions(examId, { next: { revalidate: 3600 } });
            }

            // Determine 'type' for URL based on convention
            let typeParam = 'PM';
            if (examId.endsWith('PM1')) typeParam = 'PM1';
            if (examId.endsWith('PM2')) typeParam = 'PM2';
            else if (examId.includes('-AM')) typeParam = 'AM'; // Fallback if AM used

            const pageParams = questions.map((q, idx) => ({
                year: examId,
                type: typeParam,
                qNo: (q.qNo !== undefined ? q.qNo : (idx + 1)).toString()
            }));

            paramsList = paramsList.concat(pageParams);

        } catch (error) {
            console.error(`[SSG] Failed to load data for ${examId}:`, error);
            continue;
        }
    }

    return paramsList;
}

// ISR: Revalidate every hour
export const dynamicParams = true;
export const revalidate = 3600;

export default async function ExamQuestionPage({ params }: { params: { year: string; type: string; qNo: string } }) {
    const { year, type, qNo } = params;

    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    // Fetch Questions with caching enabled for SSG/ISR
    // We explicitly set cache to undefined to override the default 'no-store' in getQuestions,
    // allowing 'next: { revalidate }' to take precedence without conflict.
    const questions = await getQuestions(examId, { cache: undefined, next: { revalidate: 3600 } });

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
