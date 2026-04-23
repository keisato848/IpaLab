/**
 * 計画ヘルスチェック純粋関数 (v2.0 MVP3 / #220).
 *
 * - 入力: PerformanceProfile
 * - 出力: PlanHealthResult (status / shouldNotify / suggestion)
 * - AI 呼び出しなし。クライアント / サーバ双方で再利用可能。
 *
 * しきい値 (plan.md より):
 *   🟢 on_track       : 達成率 >= 70%      → ポップアップ無し
 *   🟡 slight_delay   : 40% <= 達成率 <70% → 再配分提案
 *   🔴 major_delay    : 達成率 < 40%       → 再配分提案 (悪化扱い)
 *   🚀 on_fire        : 達成率 > 130% かつ on_fire 連続 3 日以上 → ペース増提案
 */

import type { PerformanceProfile } from '@/lib/types/performanceProfile';
import type {
    PlanHealthResult,
    PlanHealthStatus,
    PlanHealthSuggestion,
} from '@/lib/types/planHealth';

const ON_TRACK_MIN = 0.7;
const SLIGHT_DELAY_MIN = 0.4;
const ON_FIRE_RATE = 1.3;
const ON_FIRE_DAYS = 3;

export interface HealthCheckOptions {
    /** 評価時刻 (テスト固定用)。default = new Date().toISOString() */
    now?: () => string;
}

export function evaluatePlanHealth(
    profile: PerformanceProfile,
    options: HealthCheckOptions = {},
): PlanHealthResult {
    const now = options.now?.() ?? new Date().toISOString();
    const rate = normalizeAchievementRate(profile.recentAchievementRate);
    const onFireDays = normalizeConsecutiveOnFireDays(profile.consecutiveOnFireDays);

    const status = classifyStatus(rate, onFireDays);
    const suggestion = buildSuggestion(status, rate, onFireDays);
    const shouldNotify = status !== 'on_track';

    return {
        status,
        achievementRate: rate,
        consecutiveOnFireDays: onFireDays,
        shouldNotify,
        suggestion,
        evaluatedAt: now,
    };
}

/** 不正値 (NaN/Infinity/負数) は 0 に補正。純粋関数として防御的に扱う。 */
function normalizeAchievementRate(rate: number): number {
    if (typeof rate !== 'number' || !Number.isFinite(rate)) return 0;
    return Math.max(0, rate);
}

function normalizeConsecutiveOnFireDays(days: number): number {
    if (typeof days !== 'number' || !Number.isFinite(days)) return 0;
    return Math.max(0, Math.floor(days));
}

function classifyStatus(rate: number, onFireDays: number): PlanHealthStatus {
    if (rate > ON_FIRE_RATE && onFireDays >= ON_FIRE_DAYS) return 'on_fire';
    if (rate >= ON_TRACK_MIN) return 'on_track';
    if (rate >= SLIGHT_DELAY_MIN) return 'slight_delay';
    return 'major_delay';
}

function buildSuggestion(
    status: PlanHealthStatus,
    rate: number,
    onFireDays: number,
): PlanHealthSuggestion {
    const pct = Math.round(rate * 100);
    switch (status) {
        case 'on_track':
            return {
                kind: 'none',
                headline: '計画通りに進んでいます',
                body: `直近7日の達成率は ${pct}% です。この調子でいきましょう。`,
                action: null,
            };
        case 'slight_delay':
            return {
                kind: 'replan_recommended',
                headline: 'ペースが少し落ちています',
                body: `直近7日の達成率は ${pct}%。残りの計画を見直してリカバリしませんか？`,
                action: 'open_replan',
            };
        case 'major_delay':
            return {
                kind: 'replan_recommended',
                headline: '計画と実績にギャップがあります',
                body: `直近7日の達成率は ${pct}%。今のペースに合わせて計画を再配分しましょう。`,
                action: 'open_replan',
            };
        case 'on_fire':
            return {
                kind: 'celebrate_and_boost',
                headline: '絶好調！もう一段上を目指しませんか？',
                body: `${onFireDays}日連続で計画を大幅に上回っています (達成率 ${pct}%)。試験までの計画を前倒しできます。`,
                action: 'increase_pace',
            };
    }
}
