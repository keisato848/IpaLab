import { describe, expect, it } from 'vitest';
import {
    buildQuestionSessionStats,
    filterTodayRecords,
    incrementStats,
} from '@/components/features/exam/sessionStats';
import type { SessionStatsRecord } from '@/components/features/exam/sessionStats';

describe('当日ベースのセッション集計', () => {
    it('sessionIdの違いに関係なく当日のレコードのみを抽出する', () => {
        const today = new Date(2026, 3, 28, 12, 0, 0);
        const records: SessionStatsRecord[] = [
            { answeredAt: new Date(2026, 3, 28, 10, 0, 0).toISOString(), isCorrect: true, sessionId: 's1' },
            { answeredAt: new Date(2026, 3, 28, 11, 0, 0).toISOString(), isCorrect: false, sessionId: 's2' },
            { answeredAt: new Date(2026, 3, 27, 23, 59, 0).toISOString(), isCorrect: true, sessionId: 's1' },
        ];

        const todayRecords = filterTodayRecords(records, today);
        expect(todayRecords).toHaveLength(2);
        expect(todayRecords.map(r => r.sessionId)).toEqual(['s1', 's2']);
    });

    it('表示用の当日集計と保存用の現在セッション集計を分離する', () => {
        const today = new Date(2026, 3, 28, 12, 0, 0);
        const records: SessionStatsRecord[] = [
            { answeredAt: new Date(2026, 3, 28, 9, 0, 0).toISOString(), isCorrect: true, sessionId: 'current' },
            { answeredAt: new Date(2026, 3, 28, 10, 0, 0).toISOString(), isCorrect: false, sessionId: 'other' },
            { answeredAt: new Date(2026, 3, 27, 10, 0, 0).toISOString(), isCorrect: true, sessionId: 'current' },
        ];

        const { displayStats, currentSessionStats } = buildQuestionSessionStats(records, 'current', today);

        expect(displayStats).toEqual({ total: 2, correct: 1 });
        expect(currentSessionStats).toEqual({ total: 2, correct: 2 });
        expect(incrementStats(currentSessionStats, false)).toEqual({ total: 3, correct: 2 });
    });
});

