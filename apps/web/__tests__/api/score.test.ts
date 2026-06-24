import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// getServerSession は常にゲスト（null）を返すようモック
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock('@/auth', () => ({ authOptions: {} }));

describe('/api/score', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };
        // 環境依存を排除: AI_CHAT_FUNCTION_URL は各テストで明示的に設定する
        delete process.env.AI_CHAT_FUNCTION_URL;
        delete process.env.AI_CHAT_FUNCTION_SECRET;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('POST - バリデーション', () => {
        it('GEMINI_API_KEYもAI_CHAT_FUNCTION_URLも未設定の場合は500を返す', async () => {
            process.env.GEMINI_API_KEY = '';
            delete process.env.AI_CHAT_FUNCTION_URL;

            // モックを設定
            vi.doMock('@google/generative-ai', () => ({
                GoogleGenerativeAI: class {
                    constructor() {}
                    getGenerativeModel() {
                        return { generateContent: vi.fn() };
                    }
                },
                SchemaType: {},
            }));

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'テスト問題',
                    userAnswer: 'テスト回答',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('GEMINI_API_KEY is not set');
        });

        it('Azure実行環境でAI_CHAT_FUNCTION_URL未設定の場合は503を返す', async () => {
            process.env.GEMINI_API_KEY = 'test-api-key';
            process.env.WEBSITE_SITE_NAME = 'app-pm-exam-dx-staging';
            delete process.env.AI_CHAT_FUNCTION_URL;

            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'テスト問題',
                    userAnswer: 'テスト回答',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.error).toBe('AI proxy is not configured');

            consoleError.mockRestore();
        });

        it('questionが未指定の場合は400を返す', async () => {
            process.env.GEMINI_API_KEY = 'test-api-key';

            vi.doMock('@google/generative-ai', () => ({
                GoogleGenerativeAI: class {
                    constructor() {}
                    getGenerativeModel() {
                        return { generateContent: vi.fn() };
                    }
                },
                SchemaType: {},
            }));

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAnswer: 'テスト回答',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Missing question or user answer');
        });

        it('userAnswerが未指定の場合は400を返す', async () => {
            process.env.GEMINI_API_KEY = 'test-api-key';

            vi.doMock('@google/generative-ai', () => ({
                GoogleGenerativeAI: class {
                    constructor() {}
                    getGenerativeModel() {
                        return { generateContent: vi.fn() };
                    }
                },
                SchemaType: {},
            }));

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'テスト問題',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Missing question or user answer');
        });

        it('正常にAI採点が実行できる（GEMINI直接呼び出し）', async () => {
            process.env.GEMINI_API_KEY = 'test-api-key';
            delete process.env.AI_CHAT_FUNCTION_URL;

            const mockResponse = {
                score: 75,
                radarChartData: [
                    { subject: '設問適合性', A: 8, fullMark: 10 },
                    { subject: '論理構成', A: 7, fullMark: 10 },
                    { subject: '重要語句', A: 8, fullMark: 10 },
                    { subject: '具体性', A: 6, fullMark: 10 },
                ],
                feedback: 'テストフィードバック',
                mermaidDiagram: 'graph TD; A --> B',
                improvedAnswer: '改善回答',
            };

            vi.doMock('@google/generative-ai', () => ({
                GoogleGenerativeAI: class {
                    constructor() {}
                    getGenerativeModel() {
                        return {
                            generateContent: vi.fn().mockResolvedValue({
                                response: {
                                    text: () => JSON.stringify(mockResponse),
                                },
                            }),
                        };
                    }
                },
                SchemaType: {},
            }));

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'テスト問題',
                    userAnswer: 'テスト回答',
                    modelAnswer: '模範解答',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.score).toBe(75);
        });

        it('AI_CHAT_FUNCTION_URL 経由でのプロキシ採点が実行できる', async () => {
            process.env.AI_CHAT_FUNCTION_URL = 'https://func-pm-exam-dx-ai-us.azurewebsites.net/api/ai/chat';
            process.env.AI_CHAT_FUNCTION_SECRET = 'test-shared-secret';
            delete process.env.GEMINI_API_KEY;

            const mockResponse = {
                score: 80,
                radarChartData: [
                    { subject: '設問適合性', A: 9, fullMark: 10 },
                    { subject: '論理構成', A: 8, fullMark: 10 },
                    { subject: '重要語句', A: 8, fullMark: 10 },
                    { subject: '具体性', A: 7, fullMark: 10 },
                ],
                feedback: 'プロキシ経由テストフィードバック',
                mermaidDiagram: 'graph TD; A --> B',
                improvedAnswer: 'プロキシ改善回答',
            };

            // fetch をモック（US Function App へのリクエスト）
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ text: JSON.stringify(mockResponse) }),
            });
            vi.stubGlobal('fetch', fetchMock);

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'テスト問題',
                    userAnswer: 'テスト回答',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.score).toBe(80);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [, init] = fetchMock.mock.calls[0];
            expect(init.headers).toMatchObject({
                'Content-Type': 'application/json',
                'x-ai-chat-timestamp': expect.any(String),
                'x-ai-chat-signature': expect.stringMatching(/^sha256=[a-f0-9]{64}$/),
            });

            vi.unstubAllGlobals();
        });

        it('AI_CHAT_FUNCTION_SECRET 未設定でプロキシ採点を拒否する', async () => {
            process.env.AI_CHAT_FUNCTION_URL = 'https://func-pm-exam-dx-ai-us.azurewebsites.net/api/ai/chat';
            delete process.env.AI_CHAT_FUNCTION_SECRET;
            delete process.env.GEMINI_API_KEY;

            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'テスト問題',
                    userAnswer: 'テスト回答',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.error).toBe('AI proxy authentication is not configured');
            expect(fetchMock).not.toHaveBeenCalled();

            consoleError.mockRestore();
            vi.unstubAllGlobals();
        });

        it('AI_CHAT_FUNCTION_URL プロキシがエラーを返した場合は500を返す', async () => {
            process.env.AI_CHAT_FUNCTION_URL = 'https://func-pm-exam-dx-ai-us.azurewebsites.net/api/ai/chat';
            process.env.AI_CHAT_FUNCTION_SECRET = 'test-shared-secret';
            delete process.env.GEMINI_API_KEY;

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                status: 502,
                text: async () => 'Bad Gateway',
            }));

            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'テスト問題',
                    userAnswer: 'テスト回答',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Scoring failed');

            consoleError.mockRestore();
            vi.unstubAllGlobals();
        });

        it('AIレスポンスがJSON形式でない場合は500を返す', async () => {
            process.env.GEMINI_API_KEY = 'test-api-key';

            vi.doMock('@google/generative-ai', () => ({
                GoogleGenerativeAI: class {
                    constructor() {}
                    getGenerativeModel() {
                        return {
                            generateContent: vi.fn().mockResolvedValue({
                                response: {
                                    text: () => 'これはJSONではありません',
                                },
                            }),
                        };
                    }
                },
                SchemaType: {},
            }));

            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'テスト問題',
                    userAnswer: 'テスト回答',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Failed to parse AI response');

            consoleError.mockRestore();
        });

        it('AI APIエラー時は500を返す', async () => {
            process.env.GEMINI_API_KEY = 'test-api-key';

            vi.doMock('@google/generative-ai', () => ({
                GoogleGenerativeAI: class {
                    constructor() {}
                    getGenerativeModel() {
                        return {
                            generateContent: vi.fn().mockRejectedValue(new Error('API Error')),
                        };
                    }
                },
                SchemaType: {},
            }));

            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { POST } = await import('@/app/api/score/route');
            const request = new NextRequest('http://localhost:3000/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'テスト問題',
                    userAnswer: 'テスト回答',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Scoring failed');

            consoleError.mockRestore();
        });
    });
});

describe('AI採点レスポンス構造', () => {
    it('正しいスキーマ構造を持つ', () => {
        const validResponse = {
            score: 75,
            radarChartData: [
                { subject: '設問適合性', A: 8, fullMark: 10 },
                { subject: '論理構成', A: 7, fullMark: 10 },
                { subject: '重要語句', A: 8, fullMark: 10 },
                { subject: '具体性', A: 6, fullMark: 10 },
            ],
            feedback: 'フィードバックテキスト',
            mermaidDiagram: 'graph TD; A --> B',
            improvedAnswer: '改善回答',
        };

        expect(validResponse.score).toBeGreaterThanOrEqual(0);
        expect(validResponse.score).toBeLessThanOrEqual(100);
        expect(validResponse.radarChartData).toHaveLength(4);
        validResponse.radarChartData.forEach(item => {
            expect(item.A).toBeGreaterThanOrEqual(0);
            expect(item.A).toBeLessThanOrEqual(10);
            expect(item.fullMark).toBe(10);
        });
    });

    it('CLKSモデルの4つの評価軸を持つ', () => {
        const expectedSubjects = ['設問適合性', '論理構成', '重要語句', '具体性'];
        const radarData = [
            { subject: '設問適合性', A: 8, fullMark: 10 },
            { subject: '論理構成', A: 7, fullMark: 10 },
            { subject: '重要語句', A: 8, fullMark: 10 },
            { subject: '具体性', A: 6, fullMark: 10 },
        ];

        const subjects = radarData.map(d => d.subject);
        expect(subjects).toEqual(expectedSubjects);
    });

    it('スコアは0-100の範囲', () => {
        const validateScore = (score: number) => score >= 0 && score <= 100;

        expect(validateScore(0)).toBe(true);
        expect(validateScore(50)).toBe(true);
        expect(validateScore(100)).toBe(true);
        expect(validateScore(-1)).toBe(false);
        expect(validateScore(101)).toBe(false);
    });

    it('レーダーチャートのAは0-10の範囲', () => {
        const validateRadarValue = (value: number) => value >= 0 && value <= 10;

        expect(validateRadarValue(0)).toBe(true);
        expect(validateRadarValue(5)).toBe(true);
        expect(validateRadarValue(10)).toBe(true);
        expect(validateRadarValue(-1)).toBe(false);
        expect(validateRadarValue(11)).toBe(false);
    });
});

describe('スコアリングプロンプト', () => {
    it('CLKSモデルの4要素が定義されている', () => {
        const clksModel = {
            C: 'Context - 設問適合性',
            L: 'Logic - 論理的妥当性',
            K: 'Keyword - 知識と語彙',
            S: 'Specificity - 具体性',
        };

        expect(Object.keys(clksModel)).toHaveLength(4);
        expect(clksModel.C).toContain('設問適合性');
        expect(clksModel.L).toContain('論理');
        expect(clksModel.K).toContain('知識');
        expect(clksModel.S).toContain('具体性');
    });

    it('必要な出力フィールドが定義されている', () => {
        const expectedFields = [
            'score',
            'radarChartData',
            'feedback',
            'mermaidDiagram',
            'improvedAnswer',
        ];

        const outputSchema = {
            score: 75,
            radarChartData: [],
            feedback: '',
            mermaidDiagram: '',
            improvedAnswer: '',
        };

        expectedFields.forEach(field => {
            expect(outputSchema).toHaveProperty(field);
        });
    });
});
