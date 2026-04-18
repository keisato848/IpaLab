/**
 * useMonthlyStats - 今月の学習統計を集計するフック
 *
 * 目標設定に依存せず、LearningRecord から今月・先月の定量データを算出。
 * ダッシュボードの「今月の進捗」カードで使用。
 */
import { useMemo } from 'react';
import { LearningRecord } from '@/lib/api';

/** 単月の学習統計 */
export interface MonthlyStat {
    /** 解答した問題数 */
    questionCount: number;
    /** 正解数 */
    correctCount: number;
    /** 正答率 (0–100) */
    accuracy: number;
    /** 学習した日数（ユニーク日数） */
    studyDays: number;
    /** 合計解答時間（秒） */
    totalTimeSec: number;
    /** 1問あたり平均解答時間（秒） */
    avgTimeSec: number;
}

/** 前月比のトレンド */
export interface MonthlyTrend {
    questionCountDiff: number;
    correctCountDiff: number;
    accuracyDiff: number;
    studyDaysDiff: number;
}

export interface MonthlyStatsResult {
    /** 今月のラベル (例: "2026年2月") */
    monthLabel: string;
    /** 今月の統計 */
    current: MonthlyStat;
    /** 先月の統計 */
    previous: MonthlyStat;
    /** 前月比トレンド */
    trend: MonthlyTrend;
    /** 今月の残り日数 */
    remainingDays: number;
    /** 今月の経過率 (0–100) */
    monthProgressPercent: number;
}

/**
 * 指定月の開始日・終了日を取得
 */
function getMonthRange(year: number, month: number): { start: Date; end: Date } {
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

/**
 * 指定期間のレコードから統計を計算
 */
function computeStats(records: LearningRecord[]): MonthlyStat {
    // questionIdで重複排除（同一問題への複数回解答は最新のみ採用）
    const latestMap = new Map<string, LearningRecord>();
    [...records]
        .sort((a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime())
        .forEach(r => { latestMap.set(r.questionId, r); });
    const uniqueRecords = Array.from(latestMap.values());

    const questionCount = uniqueRecords.length;
    const correctCount = uniqueRecords.filter(r => r.isCorrect).length;
    const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;

    // 学習日数は全解答履歴（重複含む）でユニーク日数を計算
    const uniqueDays = new Set(
        records.map(r => new Date(r.answeredAt).toISOString().split('T')[0])
    );
    const studyDays = uniqueDays.size;

    const totalTimeSec = uniqueRecords.reduce((sum, r) => sum + (r.timeTakenSeconds || 0), 0);
    const avgTimeSec = questionCount > 0 ? Math.round(totalTimeSec / questionCount) : 0;

    return { questionCount, correctCount, accuracy, studyDays, totalTimeSec, avgTimeSec };
}

export function useMonthlyStats(
    records: LearningRecord[],
    targetExamPrefix?: string
): MonthlyStatsResult {
    return useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const monthLabel = `${currentYear}年${currentMonth + 1}月`;

        // 今月の範囲
        const { start: curStart, end: curEnd } = getMonthRange(currentYear, currentMonth);

        // 先月の範囲
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth);

        // レコードフィルタリング（試験種別）
        const baseRecords = targetExamPrefix
            ? records.filter(r => r.examId?.startsWith(targetExamPrefix))
            : records;

        // 今月のレコード
        const currentRecords = baseRecords.filter(r => {
            if (!r?.answeredAt) return false;
            const d = new Date(r.answeredAt);
            return d >= curStart && d <= curEnd;
        });

        // 先月のレコード
        const previousRecords = baseRecords.filter(r => {
            if (!r?.answeredAt) return false;
            const d = new Date(r.answeredAt);
            return d >= prevStart && d <= prevEnd;
        });

        const current = computeStats(currentRecords);
        const previous = computeStats(previousRecords);

        // 前月比
        const trend: MonthlyTrend = {
            questionCountDiff: current.questionCount - previous.questionCount,
            correctCountDiff: current.correctCount - previous.correctCount,
            accuracyDiff: current.accuracy - previous.accuracy,
            studyDaysDiff: current.studyDays - previous.studyDays,
        };

        // 今月の残り日数と経過率
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const currentDay = now.getDate();
        const remainingDays = daysInMonth - currentDay;
        const monthProgressPercent = Math.round((currentDay / daysInMonth) * 100);

        return {
            monthLabel,
            current,
            previous,
            trend,
            remainingDays,
            monthProgressPercent,
        };
    }, [records, targetExamPrefix]);
}
