import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// next-authのモック
vi.mock('next-auth/react', () => ({
    useSession: vi.fn(),
}));

// guestManagerのモック
vi.mock('@/lib/guest-manager', () => ({
    guestManager: {
        getHistory: vi.fn(),
        clearHistory: vi.fn(),
    },
}));

// APIのモック
vi.mock('@/lib/api', () => ({
    syncLearningRecords: vi.fn(),
}));

describe('useGuestSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // alertのモック
        vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    it('未認証の場合は同期しない', async () => {
        const { useSession } = await import('next-auth/react');
        const { guestManager } = await import('@/lib/guest-manager');
        const { syncLearningRecords } = await import('@/lib/api');

        (useSession as any).mockReturnValue({
            data: null,
            status: 'unauthenticated',
        });

        const { useGuestSync } = await import('@/hooks/useGuestSync');
        renderHook(() => useGuestSync());

        expect(guestManager.getHistory).not.toHaveBeenCalled();
        expect(syncLearningRecords).not.toHaveBeenCalled();
    });

    it('ローディング中は同期しない', async () => {
        const { useSession } = await import('next-auth/react');
        const { guestManager } = await import('@/lib/guest-manager');
        const { syncLearningRecords } = await import('@/lib/api');

        (useSession as any).mockReturnValue({
            data: null,
            status: 'loading',
        });

        const { useGuestSync } = await import('@/hooks/useGuestSync');
        renderHook(() => useGuestSync());

        expect(guestManager.getHistory).not.toHaveBeenCalled();
        expect(syncLearningRecords).not.toHaveBeenCalled();
    });

    it('認証済みでゲスト履歴がない場合は同期しない', async () => {
        const { useSession } = await import('next-auth/react');
        const { guestManager } = await import('@/lib/guest-manager');
        const { syncLearningRecords } = await import('@/lib/api');

        (useSession as any).mockReturnValue({
            data: { user: { id: 'user-1', name: 'Test' } },
            status: 'authenticated',
        });
        (guestManager.getHistory as any).mockReturnValue([]);

        const { useGuestSync } = await import('@/hooks/useGuestSync');
        renderHook(() => useGuestSync());

        expect(guestManager.getHistory).toHaveBeenCalled();
        expect(syncLearningRecords).not.toHaveBeenCalled();
    });

    it('認証済みでゲスト履歴がある場合は同期する', async () => {
        const { useSession } = await import('next-auth/react');
        const { guestManager } = await import('@/lib/guest-manager');
        const { syncLearningRecords } = await import('@/lib/api');

        const mockHistory = [
            { userId: 'guest', questionId: 'q1', isCorrect: true },
            { userId: 'guest', questionId: 'q2', isCorrect: false },
        ];

        (useSession as any).mockReturnValue({
            data: { user: { id: 'user-1', name: 'Test' } },
            status: 'authenticated',
        });
        (guestManager.getHistory as any).mockReturnValue(mockHistory);
        (syncLearningRecords as any).mockResolvedValue({});

        const { useGuestSync } = await import('@/hooks/useGuestSync');
        renderHook(() => useGuestSync());

        await waitFor(() => {
            expect(syncLearningRecords).toHaveBeenCalledWith([
                { userId: 'user-1', questionId: 'q1', isCorrect: true },
                { userId: 'user-1', questionId: 'q2', isCorrect: false },
            ]);
        });
    });

    it('同期成功後にゲスト履歴をクリアする', async () => {
        const { useSession } = await import('next-auth/react');
        const { guestManager } = await import('@/lib/guest-manager');
        const { syncLearningRecords } = await import('@/lib/api');

        const mockHistory = [{ userId: 'guest', questionId: 'q1', isCorrect: true }];

        (useSession as any).mockReturnValue({
            data: { user: { id: 'user-1', name: 'Test' } },
            status: 'authenticated',
        });
        (guestManager.getHistory as any).mockReturnValue(mockHistory);
        (syncLearningRecords as any).mockResolvedValue({});

        const { useGuestSync } = await import('@/hooks/useGuestSync');
        renderHook(() => useGuestSync());

        await waitFor(() => {
            expect(guestManager.clearHistory).toHaveBeenCalled();
        });
    });

    it('同期成功後にアラートを表示する', async () => {
        const { useSession } = await import('next-auth/react');
        const { guestManager } = await import('@/lib/guest-manager');
        const { syncLearningRecords } = await import('@/lib/api');

        const mockHistory = [{ userId: 'guest', questionId: 'q1', isCorrect: true }];

        (useSession as any).mockReturnValue({
            data: { user: { id: 'user-1', name: 'Test' } },
            status: 'authenticated',
        });
        (guestManager.getHistory as any).mockReturnValue(mockHistory);
        (syncLearningRecords as any).mockResolvedValue({});

        const { useGuestSync } = await import('@/hooks/useGuestSync');
        renderHook(() => useGuestSync());

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalledWith('ゲスト時の学習履歴を統合しました。');
        });
    });

    it('同期エラー時は履歴をクリアしない', async () => {
        const { useSession } = await import('next-auth/react');
        const { guestManager } = await import('@/lib/guest-manager');
        const { syncLearningRecords } = await import('@/lib/api');

        const mockHistory = [{ userId: 'guest', questionId: 'q1', isCorrect: true }];

        (useSession as any).mockReturnValue({
            data: { user: { id: 'user-1', name: 'Test' } },
            status: 'authenticated',
        });
        (guestManager.getHistory as any).mockReturnValue(mockHistory);
        (syncLearningRecords as any).mockRejectedValue(new Error('Sync failed'));

        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { useGuestSync } = await import('@/hooks/useGuestSync');
        renderHook(() => useGuestSync());

        await waitFor(() => {
            expect(consoleError).toHaveBeenCalledWith('Failed to sync guest history:', expect.any(Error));
        });

        // 同期失敗時は履歴をクリアしない
        expect(guestManager.clearHistory).not.toHaveBeenCalled();

        consoleError.mockRestore();
    });

    it('2回同期しない（refで制御）', async () => {
        const { useSession } = await import('next-auth/react');
        const { guestManager } = await import('@/lib/guest-manager');
        const { syncLearningRecords } = await import('@/lib/api');

        const mockHistory = [{ userId: 'guest', questionId: 'q1', isCorrect: true }];

        (useSession as any).mockReturnValue({
            data: { user: { id: 'user-1', name: 'Test' } },
            status: 'authenticated',
        });
        (guestManager.getHistory as any).mockReturnValue(mockHistory);
        (syncLearningRecords as any).mockResolvedValue({});

        const { useGuestSync } = await import('@/hooks/useGuestSync');
        const { rerender } = renderHook(() => useGuestSync());

        await waitFor(() => {
            expect(syncLearningRecords).toHaveBeenCalledTimes(1);
        });

        // 再レンダリング
        rerender();

        // 2回目は呼ばれない
        expect(syncLearningRecords).toHaveBeenCalledTimes(1);
    });

    it('ユーザーIDがない場合は同期しない', async () => {
        const { useSession } = await import('next-auth/react');
        const { syncLearningRecords } = await import('@/lib/api');

        (useSession as any).mockReturnValue({
            data: { user: { name: 'Test' } }, // idがない
            status: 'authenticated',
        });

        const { useGuestSync } = await import('@/hooks/useGuestSync');
        renderHook(() => useGuestSync());

        // ユーザーIDがないのでsync APIは呼ばれない
        expect(syncLearningRecords).not.toHaveBeenCalled();
    });
});
