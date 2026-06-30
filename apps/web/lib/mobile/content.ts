/**
 * モバイル向けコンテンツ配信（詳細設計§6、基本設計§7.2）
 * - contentHash: 問題数 + 最終更新(_ts) から導出（manifest/個別取得で同一式）
 * - contentVersion: 全試験ハッシュの結合ハッシュ（日次差分更新の判定キー）
 */
import { createHash } from 'crypto';
import { getContainer } from '@/lib/cosmos';
import { Mobile } from '@ipa-lab/shared';

interface ExamDoc {
    id: string;
    title?: string;
    year?: number;
    type?: string;
    category?: string;
}

interface QuestionAggregate {
    examId: string;
    total: number;
    maxTs: number;
}

export function computeContentHash(examId: string, total: number, maxTs: number): string {
    return createHash('sha256').update(`${examId}:${total}:${maxTs}`).digest('hex').slice(0, 16);
}

function parseYearFromId(id: string): number {
    const m = id.match(/(19|20)\d{2}/);
    return m ? Number(m[0]) : 0;
}

export async function buildContentManifest(): Promise<Mobile.ContentManifestResponse> {
    const examsContainer = await getContainer('Exams');
    const questionsContainer = await getContainer('Questions');
    if (!examsContainer || !questionsContainer) {
        throw new Error('Database not initialized');
    }

    const { resources: exams } = await examsContainer.items
        .query<ExamDoc>('SELECT c.id, c.title, c.year, c.type, c.category FROM c')
        .fetchAll();

    const { resources: aggregates } = await questionsContainer.items
        .query<QuestionAggregate>(
            'SELECT c.examId, COUNT(1) AS total, MAX(c._ts) AS maxTs FROM c GROUP BY c.examId'
        )
        .fetchAll();
    const aggregateByExam = new Map(aggregates.map((a) => [a.examId, a]));

    const entries: Mobile.ContentManifestEntry[] = exams
        .map((exam) => {
            const agg = aggregateByExam.get(exam.id);
            const total = agg?.total ?? 0;
            const maxTs = agg?.maxTs ?? 0;
            const idParts = exam.id.split('-');
            return {
                examId: exam.id,
                title: exam.title ?? exam.id,
                year: exam.year ?? parseYearFromId(exam.id),
                type: exam.type ?? idParts[idParts.length - 1] ?? 'UNKNOWN',
                category: exam.category ?? idParts[0] ?? 'UNKNOWN',
                questionCount: total,
                contentHash: computeContentHash(exam.id, total, maxTs),
                updatedAt: new Date(maxTs * 1000).toISOString(),
            };
        })
        // 0件の試験は配信対象外（クライアントのキャッシュ破棄防壁と整合）
        .filter((entry) => entry.questionCount > 0)
        .sort((a, b) => a.examId.localeCompare(b.examId));

    const contentVersion = createHash('sha256')
        .update(entries.map((e) => `${e.examId}:${e.contentHash}`).join('|'))
        .digest('hex')
        .slice(0, 16);

    return Mobile.contentManifestResponseSchema.parse({ contentVersion, exams: entries });
}

interface QuestionDoc {
    id: string;
    examId: string;
    qNo: number;
    category?: string;
    question?: string;
    text?: string;
    options?: Array<{ id?: string; text: string }>;
    choices?: string[] | Record<string, string>;
    correctOption?: string;
    answer?: string;
    correctAnswer?: string;
    explanation?: string;
    _ts?: number;
}

export async function getExamContent(examId: string): Promise<Mobile.ExamContentResponse | null> {
    const questionsContainer = await getContainer('Questions');
    if (!questionsContainer) {
        throw new Error('Database not initialized');
    }

    const { resources: questions } = await questionsContainer.items
        .query<QuestionDoc>({
            query: 'SELECT * FROM c WHERE c.examId = @examId ORDER BY c.qNo ASC',
            parameters: [{ name: '@examId', value: examId }],
        })
        .fetchAll();

    // 0件防壁: 空コンテンツは配信しない（詳細設計§8）
    if (questions.length === 0) {
        return null;
    }

    const maxTs = questions.reduce((max, q) => Math.max(max, q._ts ?? 0), 0);
    const contentHash = computeContentHash(examId, questions.length, maxTs);

    return Mobile.examContentResponseSchema.parse({
        examId,
        contentHash,
        questions: questions.map((q) => ({
            id: q.id,
            qNo: q.qNo,
            category: q.category ?? examId.split('-')[0] ?? '',
            questionText: q.question ?? q.text ?? '',
            choices: Array.isArray(q.options)
                ? q.options.map((o) => o.text)
                : Array.isArray(q.choices)
                  ? q.choices
                  : q.choices
                    ? Object.values(q.choices)
                    : undefined,
            correctAnswer: q.correctOption ?? q.correctAnswer ?? q.answer,
            explanation: q.explanation,
        })),
    });
}
