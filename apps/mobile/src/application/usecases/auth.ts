/**
 * 認証ユースケース（詳細設計§5）
 *
 * - loginWithOAuth: OAuth PKCE フロー → token 保存 → store 更新
 * - loginAsGuest: ゲスト発行 → credential 保存 → store 更新
 * - logout: RT 失効 → 全シークレット削除 → store リセット
 * - restoreSession: 起動時に RT を読み込み → refresh → AT を復元
 */
import {
    setAccessToken,
    clearAccessToken,
    setRefreshFn,
    setUnauthorizedHandler,
} from '../../infrastructure/api/api-client';
import {
    saveRefreshToken,
    loadRefreshToken,
    clearAllSecrets,
    saveGuestCredential,
} from '../../infrastructure/auth/token-store';
import { startOAuthFlow, type OAuthProvider } from '../../infrastructure/auth/oauth-flow';
import {
    refreshTokens,
    revokeSession,
    createGuestSession,
    getSessionInfo,
} from '../../infrastructure/api/auth-api';
import { useAuthStore } from '../../store/auth-store';

export function bootstrapAuth(): void {
    setRefreshFn(refreshSession);
    setUnauthorizedHandler(() => {
        useAuthStore.getState().setUnauthenticated();
    });
}

export async function restoreSession(): Promise<void> {
    const { setAuthenticated, setUnauthenticated } = useAuthStore.getState();

    const rt = await loadRefreshToken();
    if (!rt) {
        setUnauthenticated();
        return;
    }

    const refreshed = await refreshSession();
    if (!refreshed) {
        await clearAllSecrets();
        setUnauthenticated();
        return;
    }

    const info = await getSessionInfo();
    if (info) {
        setAuthenticated({
            userId: info.userId,
            authType: info.authType as 'oauth' | 'guest',
        });
    } else {
        await clearAllSecrets();
        setUnauthenticated();
    }
}

export async function loginWithOAuth(
    provider: OAuthProvider,
): Promise<{ success: true } | { success: false; message: string }> {
    const flow = await startOAuthFlow(provider);
    if (!flow.success) {
        return { success: false, message: flow.error.message };
    }

    const { accessToken, refreshToken, userId } = flow.result;
    setAccessToken(accessToken);
    await saveRefreshToken(refreshToken);
    useAuthStore.getState().setAuthenticated({ userId, authType: 'oauth' });

    return { success: true };
}

export async function loginAsGuest(): Promise<{ success: true } | { success: false; message: string }> {
    const resp = await createGuestSession();
    if (!resp) {
        return { success: false, message: 'Failed to create guest session' };
    }

    setAccessToken(resp.tokens.accessToken);
    await saveRefreshToken(resp.tokens.refreshToken);
    // GuestCredentialResponse: { guestId, guestSecret, issuedAt, tokens }
    await saveGuestCredential({ guestId: resp.guestId, credential: resp.guestSecret });
    useAuthStore.getState().setAuthenticated({ userId: resp.guestId, authType: 'guest' });

    return { success: true };
}

export async function logout(): Promise<void> {
    const rt = await loadRefreshToken();
    if (rt) {
        await revokeSession(rt).catch(() => {/* best-effort */});
    }
    clearAccessToken();
    await clearAllSecrets();
    useAuthStore.getState().setUnauthenticated();
}

async function refreshSession(): Promise<boolean> {
    const rt = await loadRefreshToken();
    if (!rt) return false;

    const tokens = await refreshTokens(rt);
    if (!tokens) return false;

    setAccessToken(tokens.accessToken);
    await saveRefreshToken(tokens.refreshToken);
    return true;
}
