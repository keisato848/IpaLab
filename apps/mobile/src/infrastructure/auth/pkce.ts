/**
 * PKCE S256 ユーティリティ（詳細設計§5.1）
 *
 * - verifier: 256bit ランダム、Base64URL エンコード
 * - challenge: SHA-256(verifier) の Base64URL エンコード
 * - expo-crypto を使用（React Native 環境で動作）
 */
import * as Crypto from 'expo-crypto';

/** Base64URL エンコード（パディングなし） */
function toBase64Url(bytes: Uint8Array): string {
    // Array.from で downlevelIteration 不要にする
    const base64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** PKCE verifier + S256 challenge を生成する */
export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
    const randomBytes = Crypto.getRandomBytes(32);
    const verifier = toBase64Url(randomBytes);

    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
    const challenge = toBase64Url(new Uint8Array(hashBuffer));

    return { verifier, challenge };
}

/** state パラメーター生成（CSRF 対策） */
export function generateState(): string {
    const bytes = Crypto.getRandomBytes(16);
    return toBase64Url(bytes);
}
