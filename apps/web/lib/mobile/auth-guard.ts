/**
 * Mobile API 認可ガード（詳細設計§6: 入力のuserIdは信用せずJWTのsubを正本とする）
 */
import { NextRequest } from 'next/server';
import { verifyAccessToken, type MobileTokenClaims } from './jwt';
import { findSessionById } from './session-store';

/** Bearer検証 + セッション失効確認。失敗時はnull（401相当）。 */
export async function requireMobileSession(request: NextRequest): Promise<MobileTokenClaims | null> {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) return null;

    const claims = await verifyAccessToken(header.slice('Bearer '.length));
    if (!claims) return null;

    const session = await findSessionById(claims.sid);
    if (!session || session.revokedAt) return null;

    return claims;
}
