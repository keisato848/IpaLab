import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockUsersContainer: any;
let mockAccountsContainer: any;

vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn((name: string) => {
        if (name === 'Users') return Promise.resolve(mockUsersContainer);
        if (name === 'Accounts') return Promise.resolve(mockAccountsContainer);
        return Promise.resolve(null);
    }),
}));

const originalEnv = { ...process.env };

describe('staging-bypass-user', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        process.env = { ...originalEnv };
        delete process.env.STAGING_BYPASS_TARGET_USER_ID;
        delete process.env.STAGING_BYPASS_TARGET_GITHUB_ACCOUNT_ID;
        delete process.env.STAGING_BYPASS_TARGET_EMAIL;

        mockUsersContainer = {
            items: {
                query: vi.fn(),
            },
            item: vi.fn(),
        };

        mockAccountsContainer = {
            items: {
                query: vi.fn(),
            },
        };
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('既定の staging bypass ユーザーを返す', async () => {
        const { getDefaultStagingBypassUser } = await import('@/lib/staging-bypass-user');

        expect(getDefaultStagingBypassUser()).toEqual({
            id: 'staging-keisato848',
            name: 'keisato848',
            email: 'keisato848@staging.local',
            image: 'https://avatars.githubusercontent.com/keisato848',
        });
    });

    it('target user id から本番ユーザーを解決する', async () => {
        process.env.STAGING_BYPASS_TARGET_USER_ID = 'user-1';
        mockUsersContainer.item.mockReturnValueOnce({
            read: vi.fn().mockResolvedValueOnce({
                resource: {
                    id: 'user-1',
                    name: 'keisato848',
                    email: 'keisato848@example.com',
                    image: 'https://example.com/avatar.png',
                },
            }),
        });

        const { resolveStagingBypassUser } = await import('@/lib/staging-bypass-user');
        const result = await resolveStagingBypassUser();

        expect(result).toEqual({
            id: 'user-1',
            name: 'keisato848',
            email: 'keisato848@example.com',
            image: 'https://example.com/avatar.png',
        });
    });

    it('GitHub account id から本番ユーザーを解決する', async () => {
        process.env.STAGING_BYPASS_TARGET_GITHUB_ACCOUNT_ID = '72418986';
        mockAccountsContainer.items.query.mockReturnValueOnce({
            fetchAll: vi.fn().mockResolvedValueOnce({
                resources: [{ userId: 'user-2' }],
            }),
        });
        mockUsersContainer.item.mockReturnValueOnce({
            read: vi.fn().mockResolvedValueOnce({
                resource: {
                    id: 'user-2',
                    name: 'keisato848',
                    email: 'keisato848@example.com',
                    image: 'https://example.com/avatar.png',
                },
            }),
        });

        const { resolveStagingBypassUser } = await import('@/lib/staging-bypass-user');
        const result = await resolveStagingBypassUser();

        expect(result?.id).toBe('user-2');
        expect(mockAccountsContainer.items.query).toHaveBeenCalled();
        expect(mockUsersContainer.item).toHaveBeenCalledWith('user-2', 'user-2');
    });

    it('email から本番ユーザーを解決する', async () => {
        process.env.STAGING_BYPASS_TARGET_EMAIL = 'keisato848@example.com';
        mockUsersContainer.items.query.mockReturnValueOnce({
            fetchAll: vi.fn().mockResolvedValueOnce({
                resources: [{
                    id: 'user-3',
                    name: 'keisato848',
                    email: 'keisato848@example.com',
                    image: null,
                }],
            }),
        });

        const { resolveStagingBypassUser } = await import('@/lib/staging-bypass-user');
        const result = await resolveStagingBypassUser();

        expect(result).toEqual({
            id: 'user-3',
            name: 'keisato848',
            email: 'keisato848@example.com',
            image: 'https://avatars.githubusercontent.com/keisato848',
        });
    });

    it('マッピング設定があるのに対象ユーザーが見つからない場合は null を返す', async () => {
        process.env.STAGING_BYPASS_TARGET_GITHUB_ACCOUNT_ID = '72418986';
        mockAccountsContainer.items.query.mockReturnValueOnce({
            fetchAll: vi.fn().mockResolvedValueOnce({ resources: [] }),
        });

        const { hasStagingBypassTargetConfig, resolveStagingBypassUser } = await import('@/lib/staging-bypass-user');
        const result = await resolveStagingBypassUser();

        expect(hasStagingBypassTargetConfig()).toBe(true);
        expect(result).toBeNull();
    });
});