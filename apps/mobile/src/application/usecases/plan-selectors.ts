/**
 * 学習計画の表示用セレクタ（純粋関数・WP-4.2）
 *
 * SQLite/ネットワークに依存しない純粋ロジックのみを置く（ユニットテスト対象）。
 */
import type { Mobile } from '@ipa-lab/shared';

type StudyPlan = Mobile.MobileStudyPlan;
type DailyTask = StudyPlan['weeklySchedule'][number]['dailyTasks'][number];

/** ISO 文字列を YYYY-MM-DD（日付部分）へ正規化する。 */
function toDateKey(iso: string): string {
    return iso.slice(0, 10);
}

/** 複数計画から「アクティブな1件」を選ぶ。generatedAt が最新のものを採用。 */
export function selectActivePlan(plans: readonly StudyPlan[]): StudyPlan | null {
    if (plans.length === 0) return null;
    return [...plans].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0] ?? null;
}

/** 試験日まで残り日数。過去なら負値。算出不能なら null。 */
export function daysUntilExam(examDate: string, todayISO: string): number | null {
    const exam = Date.parse(toDateKey(examDate));
    const today = Date.parse(toDateKey(todayISO));
    if (Number.isNaN(exam) || Number.isNaN(today)) return null;
    return Math.round((exam - today) / 86_400_000);
}

/** 今日（todayISO）に該当する日次タスクを weeklySchedule 全体から探す。 */
export function selectTodayTask(plan: StudyPlan, todayISO: string): DailyTask | null {
    const todayKey = toDateKey(todayISO);
    for (const week of plan.weeklySchedule) {
        for (const task of week.dailyTasks ?? []) {
            if (toDateKey(task.date) === todayKey) return task;
        }
    }
    return null;
}
