/**
 * useMonthlyStats フックのテスト
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMonthlyStats } from '@/hooks/useMonthlyStats';
import { LearningRecord } from '@/lib/api';

// 現在日付を固定
const NOW = new Date('2026-02-09T10:00:00Z');

function createRecord(overrides: Partial<LearningRecord> & { answeredAt: string }): LearningRecord {
    return {
        userId: 'test-user',
        questionId: 'q-1',
        examId: 'AP-2025-Fall-AM',
        category: 'テクノロジー',
        isCorrect: true,
        answeredAt: overrides.answeredAt,
        timeTakenSeconds: 60,
        ...overrides,
    };
}

describe('useMonthlyStats', () => {
    beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    it('レコードが空の場合、ゼロ統計を返す', () => {
        const { result } = renderHook(() => useMonthlyStats([], undefined));
        expect(result.current.current.questionCount).toBe(0);
        expect(result.current.current.accuracy).toBe(0);
        expect(result.current.current.studyDays).toBe(0);
        expect(result.current.monthLabel).toBe('2026年2月');
    });

    it('今月のレコードのみカウントする', () => {
        const records = [
            // 今月 (2026年2月) -- 異なるquestionIdで3問を表現
            createRecord({ questionId: 'q-1', answeredAt: '2026-02-01T08:00:00Z', isCorrect: true }),
            createRecord({ questionId: 'q-2', answeredAt: '2026-02-05T12:00:00Z', isCorrect: false }),
            createRecord({ questionId: 'q-3', answeredAt: '2026-02-09T09:00:00Z', isCorrect: true }),
            // 先月 (2026年1月)
            createRecord({ questionId: 'q-4', answeredAt: '2026-01-15T08:00:00Z', isCorrect: true }),
            createRecord({ questionId: 'q-5', answeredAt: '2026-01-20T08:00:00Z', isCorrect: false }),
        ];

        const { result } = renderHook(() => useMonthlyStats(records, undefined));

        expect(result.current.current.questionCount).toBe(3);
        expect(result.current.current.correctCount).toBe(2);
        expect(result.current.current.accuracy).toBe(67); // 2/3 * 100 ≈ 67
        expect(result.current.current.studyDays).toBe(3);

        // 先月
        expect(result.current.previous.questionCount).toBe(2);
        expect(result.current.previous.correctCount).toBe(1);
        expect(result.current.previous.accuracy).toBe(50);
    });

    it('前月比トレンドを正しく計算する', () => {
        const records = [
            // 今月: 異なるquestionIdで3問を表現
            createRecord({ questionId: 'q-1', answeredAt: '2026-02-01T08:00:00Z', isCorrect: true }),
            createRecord({ questionId: 'q-2', answeredAt: '2026-02-02T08:00:00Z', isCorrect: true }),
            createRecord({ questionId: 'q-3', answeredAt: '2026-02-03T08:00:00Z', isCorrect: true }),
            // 先月
            createRecord({ questionId: 'q-4', answeredAt: '2026-01-10T08:00:00Z', isCorrect: false }),
        ];

        const { result } = renderHook(() => useMonthlyStats(records, undefined));

        expect(result.current.trend.questionCountDiff).toBe(2); // 3 - 1
        // 先月: 1問・isCorrect=false → correctCount = 0
        expect(result.current.previous.correctCount).toBe(0);
        expect(result.current.trend.correctCountDiff).toBe(3); // 3 - 0
        expect(result.current.trend.accuracyDiff).toBe(100); // 100% - 0%
    });

    it('targetExamPrefixでフィルタリングされる', () => {
        const records = [
            createRecord({ questionId: 'ap-q-1', answeredAt: '2026-02-01T08:00:00Z', examId: 'AP-2025-Fall-AM', isCorrect: true }),
            createRecord({ questionId: 'fe-q-1', answeredAt: '2026-02-01T08:00:00Z', examId: 'FE-2025-Fall-AM', isCorrect: false }),
            createRecord({ questionId: 'ap-q-2', answeredAt: '2026-02-02T08:00:00Z', examId: 'AP-2025-Spring-AM', isCorrect: true }),
        ];

        const { result } = renderHook(() => useMonthlyStats(records, 'AP'));

        expect(result.current.current.questionCount).toBe(2); // AP のみ
        expect(result.current.current.correctCount).toBe(2);
    });

    it('残り日数と経過率を計算する', () => {
        const { result } = renderHook(() => useMonthlyStats([], undefined));

        // 2026年2月は28日間、9日目
        expect(result.current.remainingDays).toBe(19); // 28 - 9
        expect(result.current.monthProgressPercent).toBe(32); // 9/28 * 100 ≈ 32
    });

    it('先月のレコードが無い場合、前月比はそのまま今月の値', () => {
        const records = [
            createRecord({ answeredAt: '2026-02-01T08:00:00Z', isCorrect: true }),
        ];

        const { result } = renderHook(() => useMonthlyStats(records, undefined));

        expect(result.current.previous.questionCount).toBe(0);
        expect(result.current.trend.questionCountDiff).toBe(1);
        expect(result.current.trend.accuracyDiff).toBe(100);
    });

    it('平均解答時間を計算する', () => {
        const records = [
            createRecord({ questionId: 'q-1', answeredAt: '2026-02-01T08:00:00Z', timeTakenSeconds: 30 }),
            createRecord({ questionId: 'q-2', answeredAt: '2026-02-01T09:00:00Z', timeTakenSeconds: 90 }),
        ];

        const { result } = renderHook(() => useMonthlyStats(records, undefined));

        expect(result.current.current.totalTimeSec).toBe(120);
        expect(result.current.current.avgTimeSec).toBe(60); // (30 + 90) / 2
    });
});
