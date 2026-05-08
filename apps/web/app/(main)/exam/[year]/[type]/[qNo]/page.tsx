// Rebuild Trigger (Fixed)
import Link from 'next/link';
import { Question } from '@/lib/api';
import { findQuestionByNo, hasSuspiciousPlaceholderQuestions, loadFilesystemQuestions } from '@/lib/exam-data';
import QuestionClient from '@/components/features/exam/QuestionClient';
import styles from './page.module.css';
import { Suspense } from 'react';
import { questionRepository } from '@/lib/repositories/questionRepository';

// Disable SSG, use SSR/ISR
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 3600;

import { Metadata } from 'next';
import { getExamLabel } from '@/lib/exam-utils';

export async function generateMetadata({ params }: { params: Promise<{ year: string; type: string; qNo: string }> }): Promise<Metadata> {
    const { year, type, qNo } = await params;
    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;
    const examLabel = getExamLabel(examId, { includeWesternYear: true });

    try {
        const questions = await questionRepository.listByExamId(examId);
        let question = findQuestionByNo(questions as unknown as Question[], Number.parseInt(qNo, 10));
        if (!question) {
            const fsQuestions = await loadFilesystemQuestions(examId);
            question = findQuestionByNo(fsQuestions, Number.parseInt(qNo, 10));
        }

        if (!question) return { title: `Not Found` };

        // 問題文の先頭を概要として使用
        const desc = question.text ? question.text.substring(0, 120).replace(/\n/g, ' ') + '...' : `${examLabel} 問${qNo}`;

        return {
            title: `${examLabel} Q${qNo}`,
            description: desc,
            openGraph: {
                title: `${examLabel} Q${qNo} | シカクノ`,
                description: desc,
            }
        };
    } catch {
        return { title: `シカクノ` };
    }
}

export default async function ExamQuestionPage({ params }: { params: Promise<{ year: string; type: string; qNo: string }> }) {
    const { year, type, qNo } = await params;

    const typeSuffix = type === 'AM1' ? 'AM' : type;
    const examId = year.endsWith(`-${typeSuffix}`) ? year : `${year}-${typeSuffix}`;

    // Fetch Questions
    // 状態を4種類に区別する:
    //   - 'ok'              : DB から問題セットを取得できた（その後 qNo 不一致なら本物の Not Found）
    //   - 'db_error'        : DB アクセスで例外発生（接続/権限/タイムアウト等）
    //   - 'data_unavailable': DB は応答したが、当該 examId のデータが0件（同期漏れの可能性大）
    //   - 'cosmos_partial'   : DB は応答したが、対象 qNo 欠落などの部分不整合がある
    let questions: Question[] = [];
    let loadStatus: 'ok' | 'db_error' | 'data_unavailable' | 'cosmos_partial' = 'ok';
    let dbError: unknown = null;
    const qNoInt = Number.parseInt(qNo, 10);

    try {
        const data = await questionRepository.listByExamId(examId);
        questions = data as unknown as Question[];
        if (questions.length === 0) {
            loadStatus = 'data_unavailable';
            console.warn(`[Page] Cosmos returned 0 questions for examId=${examId}. Possible sync gap.`);
        }
    } catch (e) {
        loadStatus = 'db_error';
        dbError = e;
        console.error(`[Page] Cosmos query failed for examId=${examId}:`, e instanceof Error ? e.message : e);
    }

    // Filesystem フォールバック: 全環境で有効。
    // packages/data の JSON は next.config.js の outputFileTracingIncludes で
    // standalone build に同梱される。Cosmos 同期漏れ・接続障害時の最終防衛線。
    // observability: fallback が発動した場合は warn を出して根本原因 (Cosmos 欠損 / 同期漏れ) の追跡可能性を確保する。
    const questionMissingFromCosmos = Number.isInteger(qNoInt) && !findQuestionByNo(questions, qNoInt);
    const suspiciousPlaceholderQuestions = hasSuspiciousPlaceholderQuestions(examId, questions);
    if (questions.length === 0 || questionMissingFromCosmos || suspiciousPlaceholderQuestions) {
        try {
            const cosmosQuestionCount = questions.length;
            const fsQuestions = await loadFilesystemQuestions(examId);
            const fsQuestion = Number.isInteger(qNoInt) ? findQuestionByNo(fsQuestions, qNoInt) : undefined;
            const shouldReplaceWithFs = cosmosQuestionCount === 0 || Boolean(fsQuestion) || suspiciousPlaceholderQuestions;

            if (fsQuestions.length > 0 && shouldReplaceWithFs) {
                questions = fsQuestions;
                if (cosmosQuestionCount > 0) {
                    loadStatus = 'cosmos_partial';
                }
                console.warn(
                    `[Page] Filesystem fallback engaged for examId=${examId} (loaded ${questions.length} questions). ` +
                    `Cosmos status=${loadStatus}, cosmosTotal=${cosmosQuestionCount}, requestedQNo=${qNo}. ` +
                    `Investigate sync gap, stale qNo, or DB outage.`
                );
            }
        } catch (e) {
            console.warn(`[Page] FS Data load failed for ${examId}:`, e instanceof Error ? e.message : e);
        }
    }

    // Find current question by exact qNo
    const question = findQuestionByNo(questions, qNoInt);

    if (!question) {
        // examId 配下のデータが0件 or DBエラー → "見つからない"ではなく"準備中/障害"として案内
        const isDataMissing = loadStatus === 'db_error' || questions.length === 0;
        const heading = isDataMissing
            ? `この試験のデータが見つかりません`
            : `問題が見つかりません (Q${qNo})`;
        const message = isDataMissing
            ? loadStatus === 'db_error'
                ? `データ取得時にエラーが発生しました。時間をおいて再度お試しください。問題が継続する場合は管理者にご連絡ください。`
                : `この試験 (${examId}) の問題データはまだ準備されていません。データ同期が完了していない可能性があります。`
            : `番号が正しいか確認してください。`;

        // observability: 失敗の根本原因をサーバーログに残す（Application Insights 連携を期待）
        console.warn(
            `[Page] Question render failed: examId=${examId}, qNo=${qNo}, status=${loadStatus}, total=${questions.length}` +
            (dbError instanceof Error ? `, error=${dbError.message}` : '')
        );

        return (
            <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1>{heading}</h1>
                    <p>{message}</p>
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