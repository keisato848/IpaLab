/**
 * Mobile API クライアント（詳細設計§5.2・§6）
 *
 * - Access Token はモジュールレベル変数（メモリ）に保持。SecureStore に保存しない。
 * - 401 応答時は single-flight で1回だけ refresh を試みる。
 * - refresh 失敗時は onUnauthorized コールバックを呼び出す（ログイン画面遷移）。
 * - X-Correlation-Id、X-App-Version、X-Device-Id ヘッダーを付与する。
 * - Token / メール / 回答本文をログに出力しない。
 */
import { API_BASE_URL } from '@/constants/env';
import { Mobile } from '@ipa-lab/shared';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

// ---- Access Token（メモリ保持） ----

let _accessToken: string | null = null;
let _onUnauthorized: (() => void) | null = null;

/** AT をメモリにセット（refresh 後・exchange 後に呼ぶ） */
export function setAccessToken(token: string): void {
    _accessToken = token;
}

export function clearAccessToken(): void {
    _accessToken = null;
}

/** ログアウト・認証失敗時のコールバックを登録 */
export function setUnauthorizedHandler(cb: () => void): void {
    _onUnauthorized = cb;
}

// ---- Single-flight refresh ----

let _refreshingPromise: Promise<boolean> | null = null;

/**
 * refresh 関数の外部注入（循環依存を避けるため DI）。
 * auth-usecase.ts が起動時に登録する。
 */
let _refreshFn: (() => Promise<boolean>) | null = null;

export function setRefreshFn(fn: () => Promise<boolean>): void {
    _refreshFn = fn;
}

// ---- 共通ヘッダー ----

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const correlationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const appVersion = (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        [Mobile.MOBILE_HEADERS.correlationId]: correlationId,
        [Mobile.MOBILE_HEADERS.appVersion]: appVersion,
        ...extra,
    };

    if (_accessToken) {
        headers['Authorization'] = `Bearer ${_accessToken}`;
    }

    return headers;
}

// ---- fetch ラッパー ----

export interface ApiResponse<T> {
    ok: boolean;
    status: number;
    data: T | null;
    error: Mobile.MobileApiError | null;
}

export async function apiFetch<T>(
    path: string,
    options: RequestInit = {},
): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${path}`;
    const headers = buildHeaders(options.headers as Record<string, string> | undefined);

    const res = await fetch(url, { ...options, headers });

    // 401 → single-flight refresh → 1回リトライ
    if (res.status === 401 && _refreshFn) {
        if (!_refreshingPromise) {
            _refreshingPromise = _refreshFn().finally(() => {
                _refreshingPromise = null;
            });
        }

        const refreshed = await _refreshingPromise;

        if (!refreshed) {
            clearAccessToken();
            _onUnauthorized?.();
            return { ok: false, status: 401, data: null, error: null };
        }

        // AT が更新されたので再試行
        const retryHeaders = buildHeaders(options.headers as Record<string, string> | undefined);
        const retryRes = await fetch(url, { ...options, headers: retryHeaders });
        return parseResponse<T>(retryRes);
    }

    return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<ApiResponse<T>> {
    let body: unknown;
    try {
        body = await res.json();
    } catch {
        body = null;
    }

    if (!res.ok) {
        const parsed = Mobile.mobileApiErrorSchema.safeParse(body);
        return {
            ok: false,
            status: res.status,
            data: null,
            error: parsed.success ? parsed.data : { code: 'UNKNOWN', message: 'Unknown error', retryable: false, correlationId: '' },
        };
    }

    return { ok: true, status: res.status, data: body as T, error: null };
}
