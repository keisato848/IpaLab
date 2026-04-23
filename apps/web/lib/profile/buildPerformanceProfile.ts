/**
 * PerformanceProfile 生成 (#218 / v2.0 MVP3)
 *
 * 入力:
 *   - dailyProgresses: 過去28日の DailyProgress[]
 *   - records: 過去28日の LearningRecord[] (カテゴリ別正答率の算出用)
 *   - plan: 現在の StudyPlan (達成率の planned 算出用)
 *   - today: 基準日 (YYYY-MM-DD UTC)
 *
 * すべての算出ロジックを副作用ゼロの純粋関数として実装し、ユニットテストで網羅する。
 */

import type { LearningRecord, DailyProgress } from '@ipa-lab/shared';
import type { StudyPlan } from '@/lib/types/studyPlan';
import type { PerformanceProfile, CategoryAccuracy } from '@/lib/types/performanceProfile';

const WINDOW_DAYS = 28;
const RECENT_DAYS = 7;
const ON_FIRE_THRESHOLD = 1.3;

export interface BuildPerformanceProfileInput {
    userId: string;
    dailyProgresses: DailyProgress[];
    records: LearningRecord[];
    plan?: StudyPlan;
    /** 基準日 (YYYY-MM-DD)。未指定時は new Date() の UTC 日付。 */
    today?: string;
    /** 集計時刻 (テスト固定用)。 */
    now?: () => string;
}

/** UTC 基準で YYYY-MM-DD を返す */
function todayKey(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD を UTC Date に変換 */
function parseDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
}

/** UTC 日付に n 日加算した YYYY-MM-DD を返す */
function addDays(date: string, n: number): string {
    const d = parseDate(date);
    d.setUTCDate(d.getUTCDate() + n);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD の曜日 (0=日 .. 6=土) を UTC で返す */
function weekday(date: string): number {
    return parseDate(date).getUTCDay();
}

/** plan の dailyTasks を date -> plannedQuestionCount に展開 */
function buildPlannedMap(plan: StudyPlan | undefined): Record<string, number> {
    const map: Record<string, number> = {};
    if (!plan) return map;
    for (const week of plan.weeklySchedule ?? []) {
        for (const task of week.dailyTasks ?? []) {
            map[task.date] = (map[task.date] ?? 0) + (task.questionCount ?? 0);
        }
    }
    return map;
}

/**
 * 曜日別ペース (paceByWeekday) を算出。
 * 過去28日のうち学習記録 (questionCount > 0) のある日のみで平均を取る。
 * 学習日 0 の曜日は 0 を返す。
 */
export function calcPaceByWeekday(progresses: DailyProgress[]): number[] {
    const sums = new Array<number>(7).fill(0);
    const counts = new Array<number>(7).fill(0);
    for (const p of progresses) {
        if (p.questionCount <= 0) continue;
        const w = weekday(p.date);
        sums[w] += p.questionCount;
        counts[w] += 1;
    }
    return sums.map((s, i) => (counts[i] === 0 ? 0 : s / counts[i]));
}

/**
 * 直近 n 日の達成率と末尾連続「絶好調」(>130%) 日数を算出。
 * 達成率 = sum(actual) / sum(planned)。planned 0 → 0。
 */
export function calcRecentAchievement(
    progresses: DailyProgress[],
    plannedMap: Record<string, number>,
    today: string,
    days: number = RECENT_DAYS
): { rate: number; consecutiveOnFireDays: number } {
    let actualSum = 0;
    let plannedSum = 0;
    const dailyRate: { date: string; rate: number }[] = [];

    for (let i = 0; i < days; i += 1) {
        const date = addDays(today, -i);
        const planned = plannedMap[date] ?? 0;
        const actual = progresses.find((p) => p.date === date)?.questionCount ?? 0;
        actualSum += actual;
        plannedSum += planned;
        const r = planned > 0 ? actual / planned : 0;
        dailyRate.push({ date, rate: r });
    }

    const rate = plannedSum > 0 ? actualSum / plannedSum : 0;

    // 末尾連続 (today から過去に向かって) >130% カウント
    let consecutive = 0;
    for (const d of dailyRate) {
        if (d.rate > ON_FIRE_THRESHOLD) consecutive += 1;
        else break;
    }

    return { rate, consecutiveOnFireDays: consecutive };
}

/** カテゴリ別正答率を集計 */
export function calcAccuracyByCategory(records: LearningRecord[]): Record<string, CategoryAccuracy> {
    const acc: Record<string, { total: number; correct: number }> = {};
    for (const r of records) {
        const key = r.category || 'unknown';
        if (!acc[key]) acc[key] = { total: 0, correct: 0 };
        acc[key].total += 1;
        if (r.isCorrect) acc[key].correct += 1;
    }
    const out: Record<string, CategoryAccuracy> = {};
    for (const [k, v] of Object.entries(acc)) {
        out[k] = {
            total: v.total,
            correct: v.correct,
            rate: v.total > 0 ? v.correct / v.total : 0,
        };
    }
    return out;
}

/**
 * 学習継続率と末尾連続学習日数。
 * - continuityRate = 過去28日で questionCount > 0 の日数 / 28
 * - consecutiveStudyDays = today から過去に連続して学習した日数 (1日でも空けば終了)
 */
export function calcContinuity(
    progresses: DailyProgress[],
    today: string
): { continuityRate: number; consecutiveStudyDays: number } {
    const studied = new Set<string>();
    for (const p of progresses) {
        if (p.questionCount > 0) studied.add(p.date);
    }
    let count = 0;
    for (let i = 0; i < WINDOW_DAYS; i += 1) {
        if (studied.has(addDays(today, -i))) count += 1;
    }
    let consecutive = 0;
    for (let i = 0; i < WINDOW_DAYS; i += 1) {
        if (studied.has(addDays(today, -i))) consecutive += 1;
        else break;
    }
    return { continuityRate: count / WINDOW_DAYS, consecutiveStudyDays: consecutive };
}

/**
 * ペース比 γ = 直近7日 / 過去7-14日。
 * 過去7-14日が 0 の場合は 1.0 を返す。
 */
export function calcPaceRatio(progresses: DailyProgress[], today: string): number {
    let recent = 0;
    let prev = 0;
    for (let i = 0; i < RECENT_DAYS; i += 1) {
        const date = addDays(today, -i);
        const p = progresses.find((x) => x.date === date);
        if (p) recent += p.questionCount;
    }
    for (let i = RECENT_DAYS; i < RECENT_DAYS * 2; i += 1) {
        const date = addDays(today, -i);
        const p = progresses.find((x) => x.date === date);
        if (p) prev += p.questionCount;
    }
    if (prev === 0) return 1;
    return recent / prev;
}

/**
 * PerformanceProfile を構築。
 */
export function buildPerformanceProfile(input: BuildPerformanceProfileInput): PerformanceProfile {
    const today = input.today ?? todayKey();
    const now = input.now ?? (() => new Date().toISOString());

    // 過去28日でフィルタ
    const windowStart = addDays(today, -(WINDOW_DAYS - 1));
    const progresses = input.dailyProgresses.filter((p) => p.date >= windowStart && p.date <= today);
    const records = input.records.filter((r) => {
        const dateKey = r.answeredAt.slice(0, 10);
        return dateKey >= windowStart && dateKey <= today;
    });

    const plannedMap = buildPlannedMap(input.plan);

    const paceByWeekday = calcPaceByWeekday(progresses);
    const { rate: recentAchievementRate, consecutiveOnFireDays } = calcRecentAchievement(
        progresses,
        plannedMap,
        today
    );
    const accuracyByCategory = calcAccuracyByCategory(records);
    const { continuityRate, consecutiveStudyDays } = calcContinuity(progresses, today);
    const paceRatio = calcPaceRatio(progresses, today);

    return {
        userId: input.userId,
        generatedAt: now(),
        paceByWeekday,
        recentAchievementRate,
        consecutiveOnFireDays,
        accuracyByCategory,
        continuityRate,
        consecutiveStudyDays,
        paceRatio,
    };
}
