import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// グローバルfetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API ユーティリティ', () => {
    beforeEach(() => {
        vi.resetModules();
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getExams', () => {
        it('正常にExamリストを取得できる', async () => {
            const mockExams = [
                { id: 'AP-2024-Spring', title: '応用情報 2024春' },
                { id: 'AP-2024-Fall', title: '応用情報 2024秋' }
            ];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockExams
            });

            const { getExams } = await import('@/lib/api');
            const result = await getExams();

            expect(result).toEqual(mockExams);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/exams'),
                expect.any(Object)
            );
        });

        it('APIエラー時は空配列を返す', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            const { getExams } = await import('@/lib/api');
            const result = await getExams();

            expect(result).toEqual([]);
        });

        it('ネットワークエラー時は空配列を返す', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const { getExams } = await import('@/lib/api');
            const result = await getExams();

            expect(result).toEqual([]);
        });
    });

    describe('getQuestions', () => {
        it('正常に問題リストを取得できる', async () => {
            const mockQuestions = [
                { id: 'q1', text: '問題1', options: [] },
                { id: 'q2', text: '問題2', options: [] }
            ];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockQuestions
            });

            const { getQuestions } = await import('@/lib/api');
            const result = await getQuestions('AP-2024-Spring');

            expect(result).toEqual(mockQuestions);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/exams/AP-2024-Spring/questions'),
                expect.any(Object)
            );
        });

        it('APIエラー時は空配列を返す', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            const { getQuestions } = await import('@/lib/api');
            const result = await getQuestions('invalid-exam');

            expect(result).toEqual([]);
        });
    });

    describe('saveLearningRecord', () => {
        it('正常に学習記録を保存できる', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            const { saveLearningRecord } = await import('@/lib/api');
            const record = {
                userId: 'user-1',
                questionId: 'q1',
                examId: 'AP-2024-Spring',
                category: 'セキュリティ',
                isCorrect: true,
                answeredAt: new Date().toISOString(),
                timeTakenSeconds: 30
            };

            await expect(saveLearningRecord(record)).resolves.not.toThrow();
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/learning-records'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(record)
                })
            );
        });

        it('APIエラー時は例外をスローする', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error'
            });

            const { saveLearningRecord } = await import('@/lib/api');
            const record = {
                userId: 'user-1',
                questionId: 'q1',
                examId: 'AP-2024-Spring',
                category: 'セキュリティ',
                isCorrect: true,
                answeredAt: new Date().toISOString(),
                timeTakenSeconds: 30
            };

            await expect(saveLearningRecord(record)).rejects.toThrow('API Error: 500');
        });
    });

    describe('getLearningRecords', () => {
        it('正常に学習記録を取得できる', async () => {
            const mockRecords = [
                { id: 'r1', userId: 'user-1', isCorrect: true },
                { id: 'r2', userId: 'user-1', isCorrect: false }
            ];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockRecords
            });

            const { getLearningRecords } = await import('@/lib/api');
            const result = await getLearningRecords('user-1');

            expect(result).toEqual(mockRecords);
        });

        it('examIdでフィルタできる', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => []
            });

            const { getLearningRecords } = await import('@/lib/api');
            await getLearningRecords('user-1', 'AP-2024-Spring');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('examId=AP-2024-Spring'),
                expect.any(Object)
            );
        });

        it('questionIdでフィルタできる', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => []
            });

            const { getLearningRecords } = await import('@/lib/api');
            await getLearningRecords('user-1', undefined, 'q1');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('questionId=q1'),
                expect.any(Object)
            );
        });
    });

    describe('createLearningSession', () => {
        it('正常にセッションを作成できる', async () => {
            const mockSession = {
                id: 'session-1',
                userId: 'user-1',
                examId: 'AP-2024-Spring',
                mode: 'practice',
                status: 'in-progress'
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSession
            });

            const { createLearningSession } = await import('@/lib/api');
            const result = await createLearningSession('user-1', 'AP-2024-Spring', 'practice');

            expect(result).toEqual(mockSession);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/session/create'),
                expect.objectContaining({
                    method: 'POST'
                })
            );
        });

        it('APIエラー時はnullを返す', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            const { createLearningSession } = await import('@/lib/api');
            const result = await createLearningSession('user-1', 'AP-2024-Spring', 'practice');

            expect(result).toBeNull();
        });
    });

    describe('getLearningSessions', () => {
        it('正常にセッションリストを取得できる', async () => {
            const mockSessions = [
                { id: 'session-1', status: 'completed' },
                { id: 'session-2', status: 'in-progress' }
            ];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSessions
            });

            const { getLearningSessions } = await import('@/lib/api');
            const result = await getLearningSessions();

            expect(result).toEqual(mockSessions);
        });

        it('フィルタパラメータを正しく送信する', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => []
            });

            const { getLearningSessions } = await import('@/lib/api');
            await getLearningSessions('AP-2024-Spring', 'completed', 10);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringMatching(/examId=AP-2024-Spring.*status=completed.*limit=10/)
            );
        });
    });

    describe('updateSessionProgress', () => {
        it('正常にセッションを更新できる', async () => {
            const updatedSession = {
                id: 'session-1',
                answeredCount: 5,
                correctCount: 4
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => updatedSession
            });

            const { updateSessionProgress } = await import('@/lib/api');
            const result = await updateSessionProgress('session-1', {
                answeredCount: 5,
                correctCount: 4
            });

            expect(result).toEqual(updatedSession);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/session'),
                expect.objectContaining({
                    method: 'PATCH'
                })
            );
        });
    });

    describe('getExamProgress', () => {
        it('正常に試験進捗を取得できる', async () => {
            const mockProgress = {
                id: 'user-1-AP-2024-Spring',
                userId: 'user-1',
                examId: 'AP-2024-Spring',
                bookmarks: ['q1', 'q2'],
                statusMap: {}
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockProgress
            });

            const { getExamProgress } = await import('@/lib/api');
            const result = await getExamProgress('user-1', 'AP-2024-Spring');

            expect(result).toEqual(mockProgress);
        });

        it('404時はnullを返す（進捗なし）', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            const { getExamProgress } = await import('@/lib/api');
            const result = await getExamProgress('user-1', 'AP-2024-Spring');

            expect(result).toBeNull();
        });
    });

    describe('saveExamProgress', () => {
        it('ブックマークを保存できる', async () => {
            const mockProgress = {
                id: 'user-1-AP-2024-Spring',
                bookmarks: ['q1', 'q2', 'q3']
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockProgress
            });

            const { saveExamProgress } = await import('@/lib/api');
            const result = await saveExamProgress('user-1', 'AP-2024-Spring', {
                bookmarks: ['q1', 'q2', 'q3']
            });

            expect(result).toEqual(mockProgress);
        });

        it('ステータス更新を保存できる', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            });

            const { saveExamProgress } = await import('@/lib/api');
            await saveExamProgress('user-1', 'AP-2024-Spring', {
                statusUpdate: { questionId: 'q1', isCorrect: true }
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/exam-progress'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('statusUpdate')
                })
            );
        });
    });

    describe('syncLearningRecords', () => {
        it('複数レコードを一括同期できる', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            const { syncLearningRecords } = await import('@/lib/api');
            const records = [
                { userId: 'user-1', questionId: 'q1', examId: 'exam-1', category: 'cat1', isCorrect: true, answeredAt: '2026-02-01', timeTakenSeconds: 10 },
                { userId: 'user-1', questionId: 'q2', examId: 'exam-1', category: 'cat1', isCorrect: false, answeredAt: '2026-02-01', timeTakenSeconds: 15 }
            ];

            await expect(syncLearningRecords(records)).resolves.not.toThrow();
        });

        it('空配列は何もしない', async () => {
            const { syncLearningRecords } = await import('@/lib/api');
            await syncLearningRecords([]);

            expect(mockFetch).not.toHaveBeenCalled();
        });
    });
});

describe('API_BASE 定数', () => {
    it('クライアント側では相対パスを使用', async () => {
        // windowが存在する環境をシミュレート
        const { API_BASE } = await import('@/lib/api');
        
        // テスト環境ではjsdomでwindowが存在するため相対パス
        expect(API_BASE).toContain('/api');
    });
});
