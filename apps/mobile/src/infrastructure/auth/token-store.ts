/**
 * SecureStore ラッパー（詳細設計§5.2・§7）
 *
 * - Access Token は SecureStore に保存しない（メモリのみ）。
 * - Refresh Token: 絶対TTL 30日 / 無操作TTL 14日、SecureStore 保持。
 * - ゲスト Credential: UUID + server-issued secret、SecureStore 保持。
 * - Tokens/email/回答本文をログに出力しない（セキュリティ要件）。
 */
import * as SecureStore from 'expo-secure-store';

const KEYS = {
    refreshToken: 'mobile_rt_v1',
    guestId: 'mobile_guest_id_v1',
    guestCredential: 'mobile_guest_cred_v1',
} as const;

// ---- Refresh Token ----

export async function saveRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.refreshToken, token);
}

export async function loadRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.refreshToken);
}

export async function clearRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.refreshToken);
}

// ---- Guest Credential ----

export interface GuestCredential {
    guestId: string;
    credential: string;
}

export async function saveGuestCredential(cred: GuestCredential): Promise<void> {
    await SecureStore.setItemAsync(KEYS.guestId, cred.guestId);
    await SecureStore.setItemAsync(KEYS.guestCredential, cred.credential);
}

export async function loadGuestCredential(): Promise<GuestCredential | null> {
    const [guestId, credential] = await Promise.all([
        SecureStore.getItemAsync(KEYS.guestId),
        SecureStore.getItemAsync(KEYS.guestCredential),
    ]);
    if (!guestId || !credential) return null;
    return { guestId, credential };
}

export async function clearGuestCredential(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(KEYS.guestId),
        SecureStore.deleteItemAsync(KEYS.guestCredential),
    ]);
}

/** ログアウト時: RT + ゲスト Credential をすべて削除 */
export async function clearAllSecrets(): Promise<void> {
    await Promise.all([clearRefreshToken(), clearGuestCredential()]);
}
