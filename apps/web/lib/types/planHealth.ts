/**
 * 計画ヘルスチェック型定義 (v2.0 MVP3 / #220).
 *
 * - 直近 7 日達成率と on_fire 連続日数からヘルスを判定
 * - AI 不使用の純粋関数で算出
 *
 * 関連: docs/02_design/22_AdaptiveStudyPlan.md (作成予定)
 */

export type PlanHealthStatus =
    | 'on_track' // 🟢 達成率 >= 70%
    | 'slight_delay' // 🟡 40% <= 達成率 < 70%
    | 'major_delay' // 🔴 達成率 < 40%
    | 'on_fire'; // 🚀 達成率 > 130% かつ 連続 3 日

export type PlanHealthSuggestionKind =
    | 'none' // 提案なし (順調)
    | 'replan_recommended' // 遅延 → 再配分を提案
    | 'celebrate_and_boost'; // 絶好調 → ペース上げ提案

export interface PlanHealthSuggestion {
    kind: PlanHealthSuggestionKind;
    headline: string;
    body: string;
    /** UI が呼ぶアクション識別子 */
    action: 'open_replan' | 'increase_pace' | null;
}

export interface PlanHealthResult {
    status: PlanHealthStatus;
    /** 直近 7 日達成率 (0..) */
    achievementRate: number;
    /** on_fire 連続日数 */
    consecutiveOnFireDays: number;
    /** ポップアップを出すべきか (純粋判定; スロットリングは UI 側) */
    shouldNotify: boolean;
    /** UI 表示用提案 */
    suggestion: PlanHealthSuggestion;
    /** 判定時刻 (ISO) */
    evaluatedAt: string;
}
