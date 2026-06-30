/**
 * Mobile 認証 API（詳細設計§6）
 * /api/mobile/v1/auth/* エンドポイントの型付きラッパー。
 * Provider token は端末へ返さない（BFF 方式）。
 */
import { apiFetch } from './api-client';
import { Mobile } from '@ipa-lab/shared';

/** POST /auth/authorize — PKCE トランザクション開始 */
export async function authorizeTransaction(
    req: Mobile.AuthorizeRequest,
): Promise<Mobile.AuthorizeResponse | null> {
    const res = await apiFetch<Mobile.AuthorizeResponse>('/api/mobile/v1/auth/authorize', {
        method: 'POST',
        body: JSON.stringify(req),
    });
    return res.ok ? res.data : null;
}

/** POST /auth/exchange — bridge code + PKCE verifier → Mobile session */
export async function exchangeBridgeCode(
    req: Mobile.ExchangeRequest,
): Promise<Mobile.ExchangeResponse | null> {
    const res = await apiFetch<Mobile.ExchangeResponse>('/api/mobile/v1/auth/exchange', {
        method: 'POST',
        body: JSON.stringify(req),
    });
    return res.ok ? res.data : null;
}

/** POST /auth/refresh — RT ローテーション → 新 AT + RT */
export async function refreshTokens(
    refreshToken: string,
): Promise<Mobile.TokenPair | null> {
    const res = await apiFetch<Mobile.TokenPair>('/api/mobile/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken } satisfies Mobile.RefreshRequest),
    });
    return res.ok ? res.data : null;
}

/** POST /auth/revoke — セッション失効（ログアウト） */
export async function revokeSession(refreshToken: string): Promise<boolean> {
    const res = await apiFetch<unknown>('/api/mobile/v1/auth/revoke', {
        method: 'POST',
        body: JSON.stringify({ refreshToken } satisfies Mobile.RefreshRequest),
    });
    return res.status === 204 || res.ok;
}

/** GET /auth/me — セッション確認 */
export async function getSessionInfo(): Promise<Mobile.SessionInfo | null> {
    const res = await apiFetch<Mobile.SessionInfo>('/api/mobile/v1/auth/me');
    return res.ok ? res.data : null;
}

/** POST /auth/guest — ゲスト発行 */
export async function createGuestSession(): Promise<Mobile.GuestCredentialResponse | null> {
    const res = await apiFetch<Mobile.GuestCredentialResponse>('/api/mobile/v1/auth/guest', {
        method: 'POST',
        body: JSON.stringify({}),
    });
    return res.ok ? res.data : null;
}
