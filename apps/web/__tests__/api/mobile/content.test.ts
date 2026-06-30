import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Mobile } from '@ipa-lab/shared';

vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn(),
}));

const examDocs = [
    { id: 'AP-2024-Spring-AM', title: '応用情報 2024春 午前', year: 2024, type: 'AM', category: 'AP' },
    { id: 'SC-2023-Autumn-PM1', title: '情報処理安全確保支援士 2023秋 午後1' },
    { id: 'FE-EMPTY-AM', title: '問題未投入の試験' },
];

const questionAggregates = [
    { examId: 'AP-2024-Spring-AM', total: 80, maxTs: 1750000000 },
    { examId: 'SC-2023-Autumn-PM1', total: 3, maxTs: 1750001234 },
];

const apQuestions = Array.from({ length: 3 }, (_, i) => ({
    id: `q${i + 1}`,
    examId: 'AP-2024-Spring-AM',
    qNo: i + 1,
    category: 'セキュリティ',
    question: `問題文${i + 1}`,
    choices: ['ア', 'イ', 'ウ', 'エ'],
    answer: 'ア',
    explanation: '解説',
    _ts: 1750000000 - i,
}));

async function setupContainers(questionsForExam: unknown[] = apQuestions) {
    const { getContainer } = await import('@/lib/cosmos');
    (getContainer as ReturnType<typeof vi.fn>).mockImplementation(async (name: string) => {
        if (name === 'Exams') {
            return {
                items: {
                    query: () => ({ fetchAll: async () => ({ resources: examDocs }) }),
                },
            };
        }
        if (name === 'Questions') {
            return {
                items: {
                    query: (spec: unknown) => ({
                        fetchAll: async () => {
                            // GROUP BY 集計クエリと examId 指定クエリを判別
                            if (typeof spec === 'string') {
                                return { resources: questionAggregates };
                            }
                            return { resources: questionsForExam };
                        },
                    }),
                },
            };
        }
        return undefined;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
});

describe('GET /api/mobile/v1/content/manifest', () => {
    it('manifestをDTOスキーマ準拠で返し0件試験を除外する', async () => {
        await setupContainers();
        const { GET } = await import('@/app/api/mobile/v1/content/manifest/route');
        const res = await GET(new NextRequest('http://localhost/api/mobile/v1/content/manifest'));
        expect(res.status).toBe(200);

        const body = await res.json();
        const parsed = Mobile.contentManifestResponseSchema.safeParse(body);
        expect(parsed.success).toBe(true);
        expect(body.exams).toHaveLength(2); // FE-EMPTY-AM は除外
        expect(body.exams.map((e: { examId: string }) => e.examId)).not.toContain('FE-EMPTY-AM');
        expect(res.headers.get('ETag')).toBe(`"${body.contentVersion}"`);
    });

    it('If-None-Match一致で304を返す', async () => {
        await setupContainers();
        const { GET } = await import('@/app/api/mobile/v1/content/manifest/route');
        const first = await GET(new NextRequest('http://localhost/api/mobile/v1/content/manifest'));
        const etag = first.headers.get('ETag');
        expect(etag).toBeTruthy();

        const second = await GET(
            new NextRequest('http://localhost/api/mobile/v1/content/manifest', {
                headers: { 'if-none-match': etag as string },
            })
        );
        expect(second.status).toBe(304);
    });

    it('DB未初期化時に共通エラー形式の500を返す', async () => {
        const { getContainer } = await import('@/lib/cosmos');
        (getContainer as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        const { GET } = await import('@/app/api/mobile/v1/content/manifest/route');
        const res = await GET(new NextRequest('http://localhost/api/mobile/v1/content/manifest'));
        expect(res.status).toBe(500);
        const parsed = Mobile.mobileApiErrorSchema.safeParse(await res.json());
        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.retryable).toBe(true);
    });
});

describe('GET /api/mobile/v1/content/exams/{examId}', () => {
    it('試験コンテンツをDTOスキーマ準拠で返す', async () => {
        await setupContainers();
        const { GET } = await import('@/app/api/mobile/v1/content/exams/[examId]/route');
        const req = new NextRequest('http://localhost/api/mobile/v1/content/exams/AP-2024-Spring-AM', {
            headers: { 'X-Correlation-Id': 'test-corr-1' },
        });
        const res = await GET(req, { params: Promise.resolve({ examId: 'AP-2024-Spring-AM' }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('X-Correlation-Id')).toBe('test-corr-1');

        const body = await res.json();
        const parsed = Mobile.examContentResponseSchema.safeParse(body);
        expect(parsed.success).toBe(true);
        expect(body.questions).toHaveLength(3);
        expect(body.questions[0].questionText).toBe('問題文1');
    });

    it('options[{id,text}]/correctOption 形式を choices/correctAnswer に変換する（実データ互換）', async () => {
        const optionQuestions = [
            {
                id: 'q1',
                examId: 'AP-2024-Spring-AM',
                qNo: 1,
                category: 'ストラテジ',
                text: '問題文1',
                options: [
                    { id: 'a', text: 'DFFT' },
                    { id: 'b', text: 'ESG' },
                    { id: 'c', text: 'GEIT' },
                    { id: 'd', text: 'SCM' },
                ],
                correctOption: 'a',
                explanation: '解説',
                _ts: 1750000000,
            },
        ];
        await setupContainers(optionQuestions);
        const { GET } = await import('@/app/api/mobile/v1/content/exams/[examId]/route');
        const req = new NextRequest('http://localhost/api/mobile/v1/content/exams/AP-2024-Spring-AM');
        const res = await GET(req, { params: Promise.resolve({ examId: 'AP-2024-Spring-AM' }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.questions[0].choices).toEqual(['DFFT', 'ESG', 'GEIT', 'SCM']);
        expect(body.questions[0].correctAnswer).toBe('a');
    });

    it('0件の試験は404を返す（0件防壁）', async () => {
        await setupContainers([]);
        const { GET } = await import('@/app/api/mobile/v1/content/exams/[examId]/route');
        const req = new NextRequest('http://localhost/api/mobile/v1/content/exams/FE-EMPTY-AM');
        const res = await GET(req, { params: Promise.resolve({ examId: 'FE-EMPTY-AM' }) });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('EXAM_CONTENT_NOT_FOUND');
        expect(body.retryable).toBe(false);
    });
});

describe('GET /api/mobile/v1/bootstrap', () => {
    it('bootstrap応答をDTOスキーマ準拠で返す', async () => {
        await setupContainers();
        const { GET } = await import('@/app/api/mobile/v1/bootstrap/route');
        const res = await GET(new NextRequest('http://localhost/api/mobile/v1/bootstrap'));
        expect(res.status).toBe(200);
        const body = await res.json();
        const parsed = Mobile.bootstrapResponseSchema.safeParse(body);
        expect(parsed.success).toBe(true);
        expect(body.syncCursor).toBeNull();
        expect(body.contentVersion).toMatch(/^[0-9a-f]{16}$/);
    });
});
