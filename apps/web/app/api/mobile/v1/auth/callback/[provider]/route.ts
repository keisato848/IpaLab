/**
 * GET /api/mobile/v1/auth/callback/{provider}（詳細設計§5.1）
 * provider code/stateを検証し、bridge codeを発行してアプリへリダイレクトする。
 * Provider tokenは端末へ返さない。リダイレクト先はallowlist固定。
 */
import { NextRequest, NextResponse } from 'next/server';
import { Mobile } from '@ipa-lab/shared';
import { resolveCallback } from '@/lib/mobile/auth-transaction';
import { fetchProviderProfile, getAppRedirectUrl } from '@/lib/mobile/oauth-providers';
import { resolveOrCreateUser } from '@/lib/mobile/account-resolver';

export const dynamic = 'force-dynamic';

function appRedirect(params: Record<string, string>): NextResponse {
    const url = new URL(getAppRedirectUrl());
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url.toString(), 302);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    try {
        const { provider } = await params;
        const parsedProvider = Mobile.oauthProviderSchema.safeParse(provider);
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!parsedProvider.success || !code || !state) {
            return appRedirect({ error: 'invalid_request' });
        }

        const profile = await fetchProviderProfile(parsedProvider.data, code);
        const user = await resolveOrCreateUser(parsedProvider.data, profile);
        const resolved = await resolveCallback(state, user.userId);
        if (!resolved) {
            return appRedirect({ error: 'invalid_state' });
        }

        return appRedirect({ bridgeCode: resolved.bridgeCode, state: resolved.clientState });
    } catch (error) {
        console.error('[mobile/auth/callback] failed:', error);
        return appRedirect({ error: 'auth_failed' });
    }
}
