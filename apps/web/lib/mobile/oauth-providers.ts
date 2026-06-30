/**
 * OAuth Provider接続（詳細設計§5.1)
 * - Provider tokenは端末へ返さない（BFF内で完結）
 * - client secretはサーバー環境変数のみ（アプリへ含めない）
 * - モバイル用OAuth AppはWeb（NextAuth）と別に環境別で用意する
 */
import { Mobile } from '@ipa-lab/shared';

export interface ProviderProfile {
    providerAccountId: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
}

interface ProviderEndpoints {
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    scope: string;
    clientIdEnv: string;
    clientSecretEnv: string;
}

const PROVIDERS: Record<Mobile.OAuthProvider, ProviderEndpoints> = {
    google: {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        scope: 'openid email profile',
        clientIdEnv: 'MOBILE_GOOGLE_CLIENT_ID',
        clientSecretEnv: 'MOBILE_GOOGLE_CLIENT_SECRET',
    },
    github: {
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scope: 'read:user user:email',
        clientIdEnv: 'MOBILE_GITHUB_CLIENT_ID',
        clientSecretEnv: 'MOBILE_GITHUB_CLIENT_SECRET',
    },
};

function getClientCredentials(provider: Mobile.OAuthProvider): { clientId: string; clientSecret: string } {
    const config = PROVIDERS[provider];
    const clientId = process.env[config.clientIdEnv];
    const clientSecret = process.env[config.clientSecretEnv];
    if (!clientId || !clientSecret) {
        throw new Error(`OAuth client for ${provider} is not configured`);
    }
    return { clientId, clientSecret };
}

/** BFF callback URL（環境別。任意redirect禁止のため固定構築） */
export function getCallbackUrl(provider: Mobile.OAuthProvider): string {
    const base = process.env.MOBILE_OAUTH_REDIRECT_BASE ?? process.env.NEXTAUTH_URL;
    if (!base) throw new Error('MOBILE_OAUTH_REDIRECT_BASE is not configured');
    return `${base.replace(/\/$/, '')}/api/mobile/v1/auth/callback/${provider}`;
}

/** アプリへの戻り先（allowlist。既定はcustom scheme） */
export function getAppRedirectUrl(): string {
    return process.env.MOBILE_OAUTH_APP_REDIRECT ?? 'shikakuno://oauth-result';
}

export function buildAuthorizationUrl(provider: Mobile.OAuthProvider, serverState: string): string {
    const config = PROVIDERS[provider];
    const { clientId } = getClientCredentials(provider);
    const url = new URL(config.authorizationUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', getCallbackUrl(provider));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scope);
    url.searchParams.set('state', serverState);
    return url.toString();
}

/** provider codeをBFF内で交換しプロフィールを取得する。tokenは返さない。 */
export async function fetchProviderProfile(
    provider: Mobile.OAuthProvider,
    code: string
): Promise<ProviderProfile> {
    const config = PROVIDERS[provider];
    const { clientId, clientSecret } = getClientCredentials(provider);

    const tokenRes = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: getCallbackUrl(provider),
        }),
    });
    if (!tokenRes.ok) {
        throw new Error(`provider token exchange failed: ${tokenRes.status}`);
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
        throw new Error('provider token exchange returned no access_token');
    }

    const userRes = await fetch(config.userInfoUrl, {
        headers: { authorization: `Bearer ${tokenJson.access_token}`, accept: 'application/json' },
    });
    if (!userRes.ok) {
        throw new Error(`provider userinfo failed: ${userRes.status}`);
    }
    const profile = (await userRes.json()) as Record<string, unknown>;

    if (provider === 'google') {
        return {
            providerAccountId: String(profile.sub ?? ''),
            email: typeof profile.email === 'string' ? profile.email : undefined,
            name: typeof profile.name === 'string' ? profile.name : undefined,
            avatarUrl: typeof profile.picture === 'string' ? profile.picture : undefined,
        };
    }
    return {
        providerAccountId: String(profile.id ?? ''),
        email: typeof profile.email === 'string' ? profile.email : undefined,
        name: typeof profile.name === 'string' ? profile.name : (profile.login as string | undefined),
        avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : undefined,
    };
}
