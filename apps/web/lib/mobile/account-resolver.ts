/**
 * NextAuthユーザー解決（詳細設計§5.1 / §14）
 * - (provider, providerAccountId) で既存Accountを解決
 * - 未登録なら新規User+Accountを作成
 * - メール一致だけでの自動リンクは行わない（§14防壁）
 */
import { randomUUID } from 'crypto';
import { getContainer } from '@/lib/cosmos';
import type { ProviderProfile } from './oauth-providers';

export async function resolveOrCreateUser(
    provider: string,
    profile: ProviderProfile
): Promise<{ userId: string; displayName?: string; avatarUrl?: string }> {
    if (!profile.providerAccountId) {
        throw new Error('providerAccountId is empty');
    }

    const accounts = await getContainer('Accounts');
    const users = await getContainer('Users');
    if (!accounts || !users) throw new Error('DB not ready');

    const { resources } = await accounts.items
        .query<{ userId: string }>({
            query: 'SELECT * FROM c WHERE c.providerAccountId = @providerAccountId AND c.provider = @provider',
            parameters: [
                { name: '@providerAccountId', value: profile.providerAccountId },
                { name: '@provider', value: provider },
            ],
        })
        .fetchAll();

    const existing = resources[0];
    if (existing) {
        return { userId: existing.userId, displayName: profile.name, avatarUrl: profile.avatarUrl };
    }

    // 新規登録（メール一致による既存ユーザーへの自動リンクはしない）
    const userId = randomUUID();
    await users.items.create({
        id: userId,
        name: profile.name,
        email: profile.email,
        image: profile.avatarUrl,
        role: 'user',
    });
    await accounts.items.create({
        id: randomUUID(),
        userId,
        type: 'oauth',
        provider,
        providerAccountId: profile.providerAccountId,
    });
    return { userId, displayName: profile.name, avatarUrl: profile.avatarUrl };
}
