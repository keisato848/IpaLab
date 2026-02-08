import { describe, it, expect, vi, beforeEach } from 'vitest';

// UUIDのモック
vi.mock('uuid', () => ({
    v4: () => 'mock-uuid-12345',
}));

// CosmosDBコンテナのモック
let mockUsersContainer: any;
let mockAccountsContainer: any;

vi.mock('@/lib/cosmos', () => ({
    getContainer: vi.fn((name: string) => {
        if (name === 'Users') return Promise.resolve(mockUsersContainer);
        if (name === 'Accounts') return Promise.resolve(mockAccountsContainer);
        return Promise.resolve(null);
    }),
}));

describe('CosmosAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();

        // モックコンテナを初期化
        mockUsersContainer = {
            items: {
                create: vi.fn(),
                query: vi.fn(),
                upsert: vi.fn(),
            },
            item: vi.fn(),
        };

        mockAccountsContainer = {
            items: {
                create: vi.fn(),
                query: vi.fn(),
            },
            item: vi.fn(),
        };
    });

    describe('createUser', () => {
        it('新しいユーザーを作成する', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            const newUser = {
                email: 'test@example.com',
                name: 'Test User',
            };

            mockUsersContainer.items.create.mockResolvedValueOnce({});

            const result = await adapter.createUser(newUser);

            expect(result).toEqual({
                ...newUser,
                id: 'mock-uuid-12345',
            });
            expect(mockUsersContainer.items.create).toHaveBeenCalledWith({
                ...newUser,
                id: 'mock-uuid-12345',
            });
        });

        it('DBが利用不可の場合はエラーをスローする', async () => {
            const { getContainer } = await import('@/lib/cosmos');
            (getContainer as any).mockResolvedValueOnce(null);

            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            await expect(adapter.createUser({ email: 'test@example.com' }))
                .rejects.toThrow('DB not ready');
        });
    });

    describe('getUser', () => {
        it('存在するユーザーを取得する', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test' };
            mockUsersContainer.item.mockReturnValueOnce({
                read: vi.fn().mockResolvedValueOnce({ resource: mockUser }),
            });

            const result = await adapter.getUser('user-1');

            expect(result).toEqual(mockUser);
            expect(mockUsersContainer.item).toHaveBeenCalledWith('user-1', 'user-1');
        });

        it('存在しないユーザーはnullを返す', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            mockUsersContainer.item.mockReturnValueOnce({
                read: vi.fn().mockResolvedValueOnce({ resource: null }),
            });

            const result = await adapter.getUser('non-existent');

            expect(result).toBeNull();
        });

        it('エラー時はnullを返す', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            mockUsersContainer.item.mockReturnValueOnce({
                read: vi.fn().mockRejectedValueOnce(new Error('DB error')),
            });

            const result = await adapter.getUser('user-1');

            expect(result).toBeNull();
        });
    });

    describe('getUserByEmail', () => {
        it('メールアドレスでユーザーを検索する', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            const mockUser = { id: 'user-1', email: 'test@example.com' };
            mockUsersContainer.items.query.mockReturnValueOnce({
                fetchAll: vi.fn().mockResolvedValueOnce({ resources: [mockUser] }),
            });

            const result = await adapter.getUserByEmail('test@example.com');

            expect(result).toEqual(mockUser);
        });

        it('見つからない場合はnullを返す', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            mockUsersContainer.items.query.mockReturnValueOnce({
                fetchAll: vi.fn().mockResolvedValueOnce({ resources: [] }),
            });

            const result = await adapter.getUserByEmail('notfound@example.com');

            expect(result).toBeNull();
        });
    });

    describe('getUserByAccount', () => {
        it('アカウント情報からユーザーを取得する', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            const mockAccount = { id: 'acc-1', userId: 'user-1', provider: 'github', providerAccountId: '12345' };
            const mockUser = { id: 'user-1', email: 'test@example.com' };

            mockAccountsContainer.items.query.mockReturnValueOnce({
                fetchAll: vi.fn().mockResolvedValueOnce({ resources: [mockAccount] }),
            });
            mockUsersContainer.item.mockReturnValueOnce({
                read: vi.fn().mockResolvedValueOnce({ resource: mockUser }),
            });

            const result = await adapter.getUserByAccount({
                provider: 'github',
                providerAccountId: '12345',
            });

            expect(result).toEqual(mockUser);
        });

        it('アカウントが見つからない場合はnullを返す', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            mockAccountsContainer.items.query.mockReturnValueOnce({
                fetchAll: vi.fn().mockResolvedValueOnce({ resources: [] }),
            });

            const result = await adapter.getUserByAccount({
                provider: 'github',
                providerAccountId: 'nonexistent',
            });

            expect(result).toBeNull();
        });
    });

    describe('updateUser', () => {
        it('ユーザー情報を更新する', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            const existingUser = { id: 'user-1', email: 'old@example.com', name: 'Old Name' };
            const updates = { id: 'user-1', name: 'New Name' };

            mockUsersContainer.item.mockReturnValueOnce({
                read: vi.fn().mockResolvedValueOnce({ resource: existingUser }),
            });
            mockUsersContainer.items.upsert.mockResolvedValueOnce({});

            const result = await adapter.updateUser(updates);

            expect(result).toEqual({
                ...existingUser,
                ...updates,
            });
            expect(mockUsersContainer.items.upsert).toHaveBeenCalled();
        });

        it('ユーザーが見つからない場合はエラー', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            mockUsersContainer.item.mockReturnValueOnce({
                read: vi.fn().mockResolvedValueOnce({ resource: null }),
            });

            await expect(adapter.updateUser({ id: 'non-existent' }))
                .rejects.toThrow('User not found');
        });
    });

    describe('deleteUser', () => {
        it('ユーザーを削除する', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            const mockDelete = vi.fn().mockResolvedValueOnce({});
            mockUsersContainer.item.mockReturnValueOnce({
                delete: mockDelete,
            });

            await adapter.deleteUser('user-1');

            expect(mockUsersContainer.item).toHaveBeenCalledWith('user-1', 'user-1');
            expect(mockDelete).toHaveBeenCalled();
        });
    });

    describe('linkAccount', () => {
        it('アカウントをリンクする', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            const account = {
                userId: 'user-1',
                provider: 'github',
                providerAccountId: '12345',
                type: 'oauth' as const,
            };

            mockAccountsContainer.items.create.mockResolvedValueOnce({});

            const result = await adapter.linkAccount(account);

            expect(result).toEqual(account);
            expect(mockAccountsContainer.items.create).toHaveBeenCalledWith({
                id: 'mock-uuid-12345',
                ...account,
            });
        });
    });

    describe('unlinkAccount', () => {
        it('アカウントのリンクを解除する', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            const mockAccount = { id: 'acc-1', userId: 'user-1', provider: 'github', providerAccountId: '12345' };
            const mockDelete = vi.fn().mockResolvedValueOnce({});

            mockAccountsContainer.items.query.mockReturnValueOnce({
                fetchAll: vi.fn().mockResolvedValueOnce({ resources: [mockAccount] }),
            });
            mockAccountsContainer.item.mockReturnValueOnce({
                delete: mockDelete,
            });

            await adapter.unlinkAccount({
                provider: 'github',
                providerAccountId: '12345',
            });

            expect(mockDelete).toHaveBeenCalled();
        });

        it('アカウントが見つからない場合は何もしない', async () => {
            const { CosmosAdapter } = await import('@/lib/auth-adapter');
            const adapter = CosmosAdapter();

            mockAccountsContainer.items.query.mockReturnValueOnce({
                fetchAll: vi.fn().mockResolvedValueOnce({ resources: [] }),
            });

            // エラーなく完了すること
            await adapter.unlinkAccount({
                provider: 'github',
                providerAccountId: 'nonexistent',
            });
        });
    });
});
