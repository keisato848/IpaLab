/**
 * POST /api/mobile/v1/auth/guest（詳細設計§5.3）
 * ゲストID・guest credential・初回トークンを発行する。
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Mobile } from '@ipa-lab/shared';
import { getContainer } from '@/lib/cosmos';
import { signAccessToken } from '@/lib/mobile/jwt';
import { createSession } from '@/lib/mobile/session-store';
import { getCorrelationId, mobileErrorResponse } from '@/lib/mobile/error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const container = await getContainer('MobileSessions');
        if (!container) throw new Error('MobileSessions container not initialized');

        const guestId = randomUUID();
        const guestSecret = randomBytes(32).toString('base64url');
        const userId = `guest:${guestId}`;
        const issuedAt = new Date().toISOString();

        // 所有証明用credential（統合時に提示、詳細設計§5.3）
        await container.items.create({
            id: `cred:${guestId}`,
            userId,
            docType: 'guest_credential',
            secretHash: createHash('sha256').update(guestSecret).digest('hex'),
            createdAt: issuedAt,
        });

        const { session, refreshToken } = await createSession({ userId, authType: 'guest' });
        const access = await signAccessToken({
            sub: userId,
            sid: session.id,
            role: 'guest',
            auth_type: 'guest',
        });

        const body: Mobile.GuestCredentialResponse = {
            guestId,
            guestSecret,
            issuedAt,
            tokens: {
                accessToken: access.token,
                refreshToken,
                accessTokenExpiresAt: access.expiresAt.toISOString(),
                refreshTokenExpiresAt: session.absoluteExpiresAt,
            },
        };
        return NextResponse.json(Mobile.guestCredentialResponseSchema.parse(body), {
            status: 201,
            headers: { [Mobile.MOBILE_HEADERS.correlationId]: getCorrelationId(request) },
        });
    } catch (error) {
        console.error('[mobile/auth/guest] failed:', error);
        return mobileErrorResponse(request, 500, 'GUEST_ISSUE_FAILED', 'ゲスト発行に失敗しました', true);
    }
}
