export type SessionStatsRecord = {
  answeredAt?: string | null;
  isCorrect: boolean;
  sessionId?: string | null;
};

export type SessionStatsSummary = {
  total: number;
  correct: number;
};

export function isAnsweredOnLocalDate(
  record: Pick<SessionStatsRecord, "answeredAt"> | null | undefined,
  now = new Date(),
): boolean {
  if (!record?.answeredAt) return false;

  const answeredAt = new Date(record.answeredAt);
  if (Number.isNaN(answeredAt.getTime())) return false;

  return (
    answeredAt.getFullYear() === now.getFullYear() &&
    answeredAt.getMonth() === now.getMonth() &&
    answeredAt.getDate() === now.getDate()
  );
}

export function filterTodayRecords<T extends SessionStatsRecord>(
  records: T[],
  now = new Date(),
): T[] {
  return records.filter((record) => isAnsweredOnLocalDate(record, now));
}

export function filterCurrentSessionRecords<T extends SessionStatsRecord>(
  records: T[],
  sessionId?: string | null,
): T[] {
  if (!sessionId) return [];
  return records.filter((record) => record.sessionId === sessionId);
}

export function summarizeRecords(
  records: Pick<SessionStatsRecord, "isCorrect">[],
): SessionStatsSummary {
  return {
    total: records.length,
    correct: records.filter((record) => record.isCorrect).length,
  };
}

export function incrementStats(
  stats: SessionStatsSummary,
  isCorrect: boolean,
): SessionStatsSummary {
  return {
    total: stats.total + 1,
    correct: stats.correct + (isCorrect ? 1 : 0),
  };
}

export function buildQuestionSessionStats<T extends SessionStatsRecord>(
  records: T[],
  sessionId?: string | null,
  now = new Date(),
): {
  displayStats: SessionStatsSummary;
  currentSessionStats: SessionStatsSummary;
} {
  const todayRecords = filterTodayRecords(records, now);
  const currentSessionRecords = filterCurrentSessionRecords(records, sessionId);

  return {
    displayStats: summarizeRecords(todayRecords),
    currentSessionStats: sessionId
      ? summarizeRecords(currentSessionRecords)
      : summarizeRecords(todayRecords),
  };
}
