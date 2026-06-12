/**
 * Outbox再試行バックオフ（基本設計§5.5 / 詳細設計§8）
 * 2, 4, 8, 16, 32, 60秒。以降は最大60秒 + jitter。8回失敗で保留（削除しない）。
 */
export const MAX_SYNC_ATTEMPTS = 8;

const BACKOFF_SECONDS = [2, 4, 8, 16, 32, 60] as const;
export const MAX_BACKOFF_SECONDS = 60;

/**
 * 次回試行までの待機秒数を返す。
 * @param attempt 1始まりの試行回数（直前に失敗した回数）
 * @param jitterRatio 0〜1のジッター係数（テスト時は固定値を注入）
 */
export function nextBackoffSeconds(attempt: number, jitterRatio: number = Math.random()): number {
    if (attempt < 1) {
        throw new RangeError('attempt must be >= 1');
    }
    const base = BACKOFF_SECONDS[attempt - 1] ?? MAX_BACKOFF_SECONDS;
    const jitter = base === MAX_BACKOFF_SECONDS ? Math.floor(jitterRatio * 10) : 0;
    return base + jitter;
}

/** 8回失敗後は自動再試行せず保留状態にする（手動同期/次回起動で再開） */
export function shouldSuspendRetry(attempt: number): boolean {
    return attempt >= MAX_SYNC_ATTEMPTS;
}
