import { describe, it, expect } from 'vitest';
import {
  toDateKey,
  aggregateDailyProgress,
  summarizeDailyProgress,
} from '@/lib/progress/aggregateDailyProgress';
import type { LearningRecord } from '@ipa-lab/shared';

const NOW = '2026-04-21T00:00:00.000Z';
const now = () => NOW;

const baseRec = (over: Partial<LearningRecord>): LearningRecord => ({
  id: '00000000-0000-0000-0000-000000000001',
  userId: 'u1',
  questionId: 'q1',
  examId: 'AP',
  category: 'tech',
  isCorrect: true,
  isFlagged: false,
  answeredAt: '2026-04-20T01:00:00.000Z',
  timeTakenSeconds: 60,
  reviewInterval: 0,
  easeFactor: 2.5,
  ...over,
});

describe('toDateKey', () => {
  it('extracts UTC YYYY-MM-DD', () => {
    expect(toDateKey('2026-04-20T23:59:59.000Z')).toBe('2026-04-20');
    expect(toDateKey('2026-04-21T00:00:00.000Z')).toBe('2026-04-21');
  });
  it('returns null on invalid input', () => {
    expect(toDateKey('not-a-date')).toBeNull();
  });
});

describe('aggregateDailyProgress', () => {
  it('aggregates per UTC day', () => {
    const records = [
      baseRec({ id: 'a', questionId: 'q1', answeredAt: '2026-04-20T10:00:00Z', isCorrect: true, timeTakenSeconds: 30 }),
      baseRec({ id: 'b', questionId: 'q2', answeredAt: '2026-04-20T11:00:00Z', isCorrect: false, timeTakenSeconds: 45 }),
      baseRec({ id: 'c', questionId: 'q3', answeredAt: '2026-04-21T01:00:00Z', isCorrect: true, timeTakenSeconds: 60 }),
    ];
    const out = aggregateDailyProgress({ userId: 'u1', records, now });
    expect(out).toHaveLength(2);
    expect(out[0].date).toBe('2026-04-20');
    expect(out[0].questionCount).toBe(2);
    expect(out[0].correctCount).toBe(1);
    expect(out[0].accuracy).toBe(50);
    expect(out[0].totalTimeSeconds).toBe(75);
    expect(out[1].date).toBe('2026-04-21');
    expect(out[1].questionCount).toBe(1);
  });

  it('uses latest answer for duplicate questionId', () => {
    const records = [
      baseRec({ id: 'a', questionId: 'q1', answeredAt: '2026-04-20T01:00:00Z', isCorrect: false, timeTakenSeconds: 30 }),
      baseRec({ id: 'b', questionId: 'q1', answeredAt: '2026-04-20T05:00:00Z', isCorrect: true, timeTakenSeconds: 60 }),
    ];
    const out = aggregateDailyProgress({ userId: 'u1', records, now });
    expect(out).toHaveLength(1);
    expect(out[0].questionCount).toBe(1);
    expect(out[0].correctCount).toBe(1);
    expect(out[0].totalTimeSeconds).toBe(60);
  });

  it('filters by from/to range (inclusive)', () => {
    const records = [
      baseRec({ id: 'a', questionId: 'q1', answeredAt: '2026-04-19T10:00:00Z' }),
      baseRec({ id: 'b', questionId: 'q2', answeredAt: '2026-04-20T10:00:00Z' }),
      baseRec({ id: 'c', questionId: 'q3', answeredAt: '2026-04-22T10:00:00Z' }),
    ];
    const out = aggregateDailyProgress({ userId: 'u1', records, from: '2026-04-20', to: '2026-04-21', now });
    expect(out.map(o => o.date)).toEqual(['2026-04-20']);
  });

  it('decides status based on plannedCounts', () => {
    const records = [
      baseRec({ id: 'a', questionId: 'q1', answeredAt: '2026-04-20T10:00:00Z' }),
      baseRec({ id: 'b', questionId: 'q2', answeredAt: '2026-04-21T10:00:00Z' }),
      baseRec({ id: 'c', questionId: 'q3', answeredAt: '2026-04-21T11:00:00Z' }),
    ];
    const plannedCounts = {
      '2026-04-20': 5, // partial
      '2026-04-21': 2, // completed
      '2026-04-22': 3, // none (no records)
    };
    const out = aggregateDailyProgress({ userId: 'u1', records, plannedCounts, from: '2026-04-20', to: '2026-04-22', now });
    const byDate = Object.fromEntries(out.map(o => [o.date, o]));
    expect(byDate['2026-04-20'].status).toBe('partial');
    expect(byDate['2026-04-21'].status).toBe('completed');
    expect(byDate['2026-04-22'].status).toBe('none');
    expect(byDate['2026-04-22'].questionCount).toBe(0);
  });

  it('treats unspecified plannedCount as completed when actual >= 1', () => {
    const records = [baseRec({ id: 'a', answeredAt: '2026-04-20T10:00:00Z' })];
    const out = aggregateDailyProgress({ userId: 'u1', records, now });
    expect(out[0].status).toBe('completed');
  });

  it('counts unique sessions when countSessions=true', () => {
    const records = [
      baseRec({ id: 'a', questionId: 'q1', sessionId: '11111111-1111-1111-1111-111111111111', answeredAt: '2026-04-20T01:00:00Z' }),
      baseRec({ id: 'b', questionId: 'q2', sessionId: '11111111-1111-1111-1111-111111111111', answeredAt: '2026-04-20T02:00:00Z' }),
      baseRec({ id: 'c', questionId: 'q3', sessionId: '22222222-2222-2222-2222-222222222222', answeredAt: '2026-04-20T03:00:00Z' }),
    ];
    const out = aggregateDailyProgress({ userId: 'u1', records, countSessions: true, now });
    expect(out[0].sessionCount).toBe(2);
  });

  it('produces examBreakdown', () => {
    const records = [
      baseRec({ id: 'a', questionId: 'q1', examId: 'AP', isCorrect: true, answeredAt: '2026-04-20T01:00:00Z' }),
      baseRec({ id: 'b', questionId: 'q2', examId: 'AP', isCorrect: false, answeredAt: '2026-04-20T02:00:00Z' }),
      baseRec({ id: 'c', questionId: 'q3', examId: 'SC', isCorrect: true, answeredAt: '2026-04-20T03:00:00Z' }),
    ];
    const out = aggregateDailyProgress({ userId: 'u1', records, now });
    expect(out[0].examBreakdown).toEqual({
      AP: { count: 2, correct: 1 },
      SC: { count: 1, correct: 1 },
    });
  });

  it('ignores records of other users', () => {
    const records = [
      baseRec({ id: 'a', userId: 'u1', questionId: 'q1', answeredAt: '2026-04-20T01:00:00Z' }),
      baseRec({ id: 'b', userId: 'other', questionId: 'q2', answeredAt: '2026-04-20T02:00:00Z' }),
    ];
    const out = aggregateDailyProgress({ userId: 'u1', records, now });
    expect(out[0].questionCount).toBe(1);
  });

  it('returns empty for no records and no plannedCounts', () => {
    const out = aggregateDailyProgress({ userId: 'u1', records: [], now });
    expect(out).toEqual([]);
  });

  it('id format is `${userId}-${date}`', () => {
    const records = [baseRec({ id: 'a', answeredAt: '2026-04-20T10:00:00Z' })];
    const out = aggregateDailyProgress({ userId: 'u1', records, now });
    expect(out[0].id).toBe('u1-2026-04-20');
  });
});

describe('summarizeDailyProgress', () => {
  it('returns zeros for empty input', () => {
    const s = summarizeDailyProgress([]);
    expect(s.totalQuestionCount).toBe(0);
    expect(s.studyDays).toBe(0);
  });

  it('aggregates totals across days', () => {
    const records = [
      baseRec({ id: 'a', questionId: 'q1', answeredAt: '2026-04-20T10:00:00Z', isCorrect: true, timeTakenSeconds: 30 }),
      baseRec({ id: 'b', questionId: 'q2', answeredAt: '2026-04-20T11:00:00Z', isCorrect: false, timeTakenSeconds: 45 }),
      baseRec({ id: 'c', questionId: 'q3', answeredAt: '2026-04-21T01:00:00Z', isCorrect: true, timeTakenSeconds: 60 }),
    ];
    const items = aggregateDailyProgress({ userId: 'u1', records, now });
    const s = summarizeDailyProgress(items);
    expect(s.totalQuestionCount).toBe(3);
    expect(s.totalCorrectCount).toBe(2);
    expect(s.accuracy).toBeCloseTo(66.7, 1);
    expect(s.studyDays).toBe(2);
    expect(s.totalTimeSeconds).toBe(135);
    expect(s.rangeFrom).toBe('2026-04-20');
    expect(s.rangeTo).toBe('2026-04-21');
  });
});
