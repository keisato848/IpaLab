import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guestManager } from '@/lib/guest-manager';

// Mock uuid
vi.mock('uuid', () => ({
    v4: () => 'mock-uuid-12345',
}));

describe('guestManager', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('getGuestId', () => {
        it('新規ゲストIDを生成して保存する', () => {
            const id = guestManager.getGuestId();
            expect(id).toBe('mock-uuid-12345');
            expect(localStorage.setItem).toHaveBeenCalledWith('ipalab_guest_id', 'mock-uuid-12345');
        });

        it('既存のゲストIDを返す', () => {
            localStorage.setItem('ipalab_guest_id', 'existing-id');
            vi.mocked(localStorage.getItem).mockReturnValueOnce('existing-id');
            
            const id = guestManager.getGuestId();
            expect(id).toBe('existing-id');
        });
    });

    describe('isGuest', () => {
        it('常にtrueを返す（スタブ実装）', () => {
            expect(guestManager.isGuest()).toBe(true);
        });
    });

    describe('警告表示状態管理', () => {
        it('初期状態では警告未表示', () => {
            expect(guestManager.hasShownWarning()).toBe(false);
        });

        it('警告表示済みをマークできる', () => {
            guestManager.markWarningShown();
            expect(localStorage.setItem).toHaveBeenCalledWith('ipalab_guest_warning_shown', 'true');
        });

        it('警告フラグをリセットできる', () => {
            guestManager.resetWarningFlag();
            expect(localStorage.removeItem).toHaveBeenCalledWith('ipalab_guest_warning_shown');
        });
    });

    describe('履歴管理', () => {
        it('履歴を保存できる', () => {
            const historyItem = { questionId: 'q1', isCorrect: true };
            guestManager.saveHistory(historyItem);
            
            expect(localStorage.setItem).toHaveBeenCalled();
        });

        it('履歴が空の場合は空配列を返す', () => {
            const history = guestManager.getHistory();
            expect(history).toEqual([]);
        });

        it('保存された履歴を取得できる', () => {
            const mockHistory = [{ questionId: 'q1', isCorrect: true }];
            vi.mocked(localStorage.getItem).mockReturnValueOnce(JSON.stringify(mockHistory));
            
            const history = guestManager.getHistory();
            expect(history).toEqual(mockHistory);
        });

        it('履歴をクリアできる', () => {
            guestManager.clearHistory();
            expect(localStorage.removeItem).toHaveBeenCalledWith('ipalab_guest_history');
        });
    });

    describe('clear', () => {
        it('全てのゲストデータをクリアする', () => {
            guestManager.clear();
            
            expect(localStorage.removeItem).toHaveBeenCalledWith('ipalab_guest_id');
            expect(localStorage.removeItem).toHaveBeenCalledWith('ipalab_guest_history');
            expect(localStorage.removeItem).toHaveBeenCalledWith('ipalab_guest_warning_shown');
        });
    });
});
