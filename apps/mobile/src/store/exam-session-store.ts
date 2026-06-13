/**
 * 現在進行中の試験セッション（Zustand）
 * - セッション開始時に sessionId と examId を登録
 * - 各問題の回答状態（selectedIndex, isSubmitted）をキャッシュ
 * - 完了時に score を記録
 */
import { create } from 'zustand';

export interface AnswerRecord {
    qNo: number;
    selectedIndex: number;
    isCorrect: boolean;
    submittedAt: string;
}

interface ExamSessionState {
    sessionId: string | null;
    examId: string | null;
    answers: Map<number, AnswerRecord>;
    startedAt: string | null;

    /** セッション開始 */
    startSession: (sessionId: string, examId: string) => void;
    /** 回答を記録 */
    recordAnswer: (record: AnswerRecord) => void;
    /** セッションをリセット */
    clearSession: () => void;
    /** 正解数 */
    correctCount: () => number;
}

export const useExamSessionStore = create<ExamSessionState>()((set, get) => ({
    sessionId: null,
    examId: null,
    answers: new Map(),
    startedAt: null,

    startSession: (sessionId, examId) =>
        set({ sessionId, examId, answers: new Map(), startedAt: new Date().toISOString() }),

    recordAnswer: (record) =>
        set((state) => {
            const next = new Map(state.answers);
            next.set(record.qNo, record);
            return { answers: next };
        }),

    clearSession: () =>
        set({ sessionId: null, examId: null, answers: new Map(), startedAt: null }),

    correctCount: () => {
        let count = 0;
        get().answers.forEach((a) => { if (a.isCorrect) count++; });
        return count;
    },
}));
