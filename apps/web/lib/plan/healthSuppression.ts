/**
 * Plan health 提案トーストのスロットリング (#221).
 *
 * - localStorage に最終通知時刻と「次回表示可能時刻」を保存
 * - 同一ヘルス継続なら 7 日 / 「後で」3 日 / 「適用」リセット
 * - ヘルスが悪化した場合 (e.g. on_track → slight_delay) はスロットリング無視
 *
 * 純粋関数で書いて localStorage アクセスは呼び出し側で行う。
 */

import type { PlanHealthStatus } from '@/lib/types/planHealth';

export interface PlanHealthSuppressionState {
    /** 最後に通知したヘルス */
    lastStatus: PlanHealthStatus;
    /** 次回表示可能時刻 (ISO) */
    nextAllowedAt: string;
}

/** ヘルス重み (悪化判定用)。on_fire は単独カテゴリ */
const SEVERITY: Record<PlanHealthStatus, number> = {
    on_track: 0,
    on_fire: 1,
    slight_delay: 2,
    major_delay: 3,
};

export function shouldShowToast(
    nextStatus: PlanHealthStatus,
    suppression: PlanHealthSuppressionState | null,
    now: Date,
): boolean {
    if (!suppression) return true;
    // 悪化 (severity が上がる) ならスロットリング無視
    if (SEVERITY[nextStatus] > SEVERITY[suppression.lastStatus]) return true;
    // ヘルスが変わって severity が下がる/異なるカテゴリでも、別ヘルスなので通知
    if (nextStatus !== suppression.lastStatus) return true;
    // 同一ヘルス継続: 期限後のみ通知
    return now.getTime() >= new Date(suppression.nextAllowedAt).getTime();
}

export type DismissReason = 'later' | 'close' | 'apply';

/** dismiss 後の suppression 状態を計算 (純粋関数) */
export function nextSuppressionState(
    status: PlanHealthStatus,
    reason: DismissReason,
    now: Date,
): PlanHealthSuppressionState | null {
    if (reason === 'apply') return null;
    const days = reason === 'later' ? 3 : 7;
    const nextAllowedAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    return { lastStatus: status, nextAllowedAt };
}

const LS_KEY = 'planHealthSuppressionV1';

export function loadSuppression(): PlanHealthSuppressionState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(LS_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PlanHealthSuppressionState;
    } catch {
        return null;
    }
}

export function saveSuppression(state: PlanHealthSuppressionState | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (state === null) window.localStorage.removeItem(LS_KEY);
        else window.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
        // ignore
    }
}
