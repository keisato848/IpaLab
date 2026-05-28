/**
 * インメモリ スライディングウィンドウ レートリミッター
 *
 * - App Service の単一インスタンス環境を前提とした軽量実装
 * - マルチインスタンスに昇格する場合は Cosmos DB / Redis ベースへの移行を検討
 */

interface RateLimitEntry {
    count: number;
    windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

/** エントリのクリーンアップ間隔（5 分） */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function maybeCleanup(windowMs: number): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, entry] of store.entries()) {
        if (now - entry.windowStart > windowMs * 2) {
            store.delete(key);
        }
    }
}

export interface RateLimitResult {
    /** リクエストを許可するかどうか */
    allowed: boolean;
    /** 残りリクエスト数 */
    remaining: number;
    /** 制限中の場合、再試行可能になるまでの秒数 */
    retryAfter?: number;
}

/**
 * レート制限チェック（スライディングウィンドウ方式）
 *
 * @param key          レート制限キー（例: `score:user:xxx`）
 * @param maxRequests  ウィンドウ内の最大リクエスト数
 * @param windowMs     ウィンドウ幅（ミリ秒）
 */
export function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number,
): RateLimitResult {
    maybeCleanup(windowMs);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
        store.set(key, { count: 1, windowStart: now });
        return { allowed: true, remaining: maxRequests - 1 };
    }

    if (entry.count >= maxRequests) {
        const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
        return { allowed: false, remaining: 0, retryAfter };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * リクエストヘッダーからクライアント IP を取得する
 * Azure App Service のリバースプロキシは X-Forwarded-For に付与する
 */
export function getClientIp(headers: Headers): string {
    return (
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        'unknown'
    );
}

/** レート制限の設定定数 */
export const RATE_LIMITS = {
    /** AI 採点エンドポイント: 認証ユーザーは 5 分に 10 回 */
    SCORE_AUTH: { maxRequests: 10, windowMs: 5 * 60 * 1000 },
    /** AI 採点エンドポイント: ゲストは 5 分に 3 回 */
    SCORE_GUEST: { maxRequests: 3, windowMs: 5 * 60 * 1000 },
    /** 学習記録 POST: 認証ユーザーは 1 分に 120 回 */
    LEARNING_RECORDS: { maxRequests: 120, windowMs: 60 * 1000 },
} as const;
