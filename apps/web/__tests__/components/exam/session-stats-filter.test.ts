import { describe, expect, it } from 'vitest';

type LearningRecordLike = {
    answeredAt?: string;
    isCorrect: boolean;
    sessionId?: string;
};

const filterTodayRecords = (records: LearningRecordLike[], now = new Date()) => {
    const today = now.toISOString().split('T')[0];
    return records.filter(r => r && r.answeredAt && r.answeredAt.startsWith(today));
};

describe('当日ベースのセッション集計', () => {
    it('sessionIdの違いに関係なく当日のレコードのみを抽出する', () => {
        const today = new Date('2026-04-28T12:00:00.000Z');
        const records: LearningRecordLike[] = [
            { answeredAt: '2026-04-28T10:00:00.000Z', isCorrect: true, sessionId: 's1' },
            { answeredAt: '2026-04-28T11:00:00.000Z', isCorrect: false, sessionId: 's2' },
            { answeredAt: '2026-04-27T11:00:00.000Z', isCorrect: true, sessionId: 's1' },
        ];

        const todayRecords = filterTodayRecords(records, today);
        expect(todayRecords).toHaveLength(2);
        expect(todayRecords.map(r => r.sessionId)).toEqual(['s1', 's2']);
    });
});

