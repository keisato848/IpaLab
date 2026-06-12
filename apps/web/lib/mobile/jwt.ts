/**
 * Mobile Access Token（詳細設計§5.2）
 * - RS256、TTL 15分
 * - claims: iss, aud, sub, sid, jti, role, auth_type, iat, exp
 * - 鍵は環境変数（PEM）から読み込む。Provider secretやNextAuth secretと共有しない。
 */
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type KeyLike } from 'jose';
import { randomUUID } from 'crypto';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const ALG = 'RS256';
const ISSUER = process.env.MOBILE_JWT_ISSUER ?? 'shikakuno-mobile';
const AUDIENCE = process.env.MOBILE_JWT_AUDIENCE ?? 'shikakuno-app';

export interface MobileTokenClaims {
    sub: string;
    sid: string;
    jti: string;
    role: 'user' | 'guest';
    auth_type: 'oauth' | 'guest';
}

let privateKeyCache: KeyLike | null = null;
let publicKeyCache: KeyLike | null = null;

async function getPrivateKey(): Promise<KeyLike> {
    if (privateKeyCache) return privateKeyCache;
    const pem = process.env.MOBILE_JWT_PRIVATE_KEY;
    if (!pem) throw new Error('MOBILE_JWT_PRIVATE_KEY is not configured');
    privateKeyCache = await importPKCS8(pem.replace(/\\n/g, '\n'), ALG);
    return privateKeyCache;
}

async function getPublicKey(): Promise<KeyLike> {
    if (publicKeyCache) return publicKeyCache;
    const pem = process.env.MOBILE_JWT_PUBLIC_KEY;
    if (!pem) throw new Error('MOBILE_JWT_PUBLIC_KEY is not configured');
    publicKeyCache = await importSPKI(pem.replace(/\\n/g, '\n'), ALG);
    return publicKeyCache;
}

/** テスト用: 鍵キャッシュを破棄する（環境変数差し替え後に呼ぶ） */
export function resetKeyCacheForTesting(): void {
    privateKeyCache = null;
    publicKeyCache = null;
}

export async function signAccessToken(
    claims: Omit<MobileTokenClaims, 'jti'>
): Promise<{ token: string; expiresAt: Date; jti: string }> {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    const token = await new SignJWT({ sid: claims.sid, role: claims.role, auth_type: claims.auth_type })
        .setProtectedHeader({ alg: ALG })
        .setSubject(claims.sub)
        .setJti(jti)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
        .sign(await getPrivateKey());
    return { token, expiresAt, jti };
}

/** 検証失敗時はnullを返す（呼び出し側で401に変換） */
export async function verifyAccessToken(token: string): Promise<MobileTokenClaims | null> {
    try {
        const { payload } = await jwtVerify(token, await getPublicKey(), {
            issuer: ISSUER,
            audience: AUDIENCE,
        });
        if (
            typeof payload.sub !== 'string' ||
            typeof payload.sid !== 'string' ||
            typeof payload.jti !== 'string' ||
            (payload.role !== 'user' && payload.role !== 'guest') ||
            (payload.auth_type !== 'oauth' && payload.auth_type !== 'guest')
        ) {
            return null;
        }
        return {
            sub: payload.sub,
            sid: payload.sid,
            jti: payload.jti,
            role: payload.role,
            auth_type: payload.auth_type,
        };
    } catch {
        return null;
    }
}
