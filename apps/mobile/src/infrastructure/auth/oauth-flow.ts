/**
 * OAuth 認可フロー（詳細設計§5.1）
 *
 * 手順:
 * 1. PKCE verifier/challenge + state を生成
 * 2. POST /auth/authorize でサーバー側トランザクション開始 → authUrl を受け取る
 * 3. expo-auth-session でシステムブラウザへ遷移
 * 4. BFF callback 後、app scheme 経由で bridge code が返る
 * 5. POST /auth/exchange で Mobile session を取得
 *
 * Provider token は端末へ返さない（BFF 方式）。
 * 任意 redirect は禁止（環境別 allowlist から解決）。
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { generatePkce, generateState } from './pkce';
import { authorizeTransaction, exchangeBridgeCode } from '../api/auth-api';
import { OAUTH_REDIRECT_URI } from '@/constants/env';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'github';

export interface OAuthResult {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    userId: string;
    authType: 'oauth';
}

export interface OAuthFlowError {
    type: 'cancelled' | 'network' | 'server' | 'invalid_state';
    message: string;
}

export async function startOAuthFlow(
    provider: OAuthProvider,
): Promise<{ success: true; result: OAuthResult } | { success: false; error: OAuthFlowError }> {
    try {
        const { verifier, challenge } = await generatePkce();
        const state = generateState();

        // POST /auth/authorize — redirectUri はサーバー側 allowlist から解決するため送らない
        const authResp = await authorizeTransaction({
            provider,
            codeChallenge: challenge,
            codeChallengeMethod: 'S256',
            state,
        });

        if (!authResp) {
            return { success: false, error: { type: 'server', message: 'Failed to start auth transaction' } };
        }

        const result = await AuthSession.openAuthSessionAsync(
            authResp.authorizationUrl,
            OAUTH_REDIRECT_URI,
        );

        if (result.type === 'cancel' || result.type === 'dismiss') {
            return { success: false, error: { type: 'cancelled', message: 'User cancelled OAuth flow' } };
        }
        if (result.type !== 'success') {
            return { success: false, error: { type: 'network', message: 'Auth session failed' } };
        }

        const url = new URL(result.url);
        const bridgeCode = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (!bridgeCode) {
            return { success: false, error: { type: 'server', message: 'No bridge code in callback' } };
        }
        if (returnedState !== state) {
            return { success: false, error: { type: 'invalid_state', message: 'State mismatch in OAuth callback' } };
        }

        // POST /auth/exchange — schema: { bridgeCode, codeVerifier }
        const exchangeResp = await exchangeBridgeCode({
            bridgeCode,
            codeVerifier: verifier,
        });

        if (!exchangeResp) {
            return { success: false, error: { type: 'server', message: 'Failed to exchange bridge code' } };
        }

        return {
            success: true,
            result: {
                accessToken: exchangeResp.tokens.accessToken,
                refreshToken: exchangeResp.tokens.refreshToken,
                accessTokenExpiresAt: exchangeResp.tokens.accessTokenExpiresAt,
                userId: exchangeResp.user.userId,  // ExchangeResponse.user.userId
                authType: 'oauth',
            },
        };
    } catch (err) {
        return {
            success: false,
            error: { type: 'network', message: err instanceof Error ? err.message : 'Unknown error' },
        };
    }
}
