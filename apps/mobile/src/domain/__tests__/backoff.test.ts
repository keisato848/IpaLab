import { nextBackoffSeconds, shouldSuspendRetry, MAX_SYNC_ATTEMPTS } from '../policies/backoff';

describe('Outboxバックオフ（詳細設計§8）', () => {
    it('2,4,8,16,32,60秒の系列を返す', () => {
        expect(nextBackoffSeconds(1, 0)).toBe(2);
        expect(nextBackoffSeconds(2, 0)).toBe(4);
        expect(nextBackoffSeconds(3, 0)).toBe(8);
        expect(nextBackoffSeconds(4, 0)).toBe(16);
        expect(nextBackoffSeconds(5, 0)).toBe(32);
        expect(nextBackoffSeconds(6, 0)).toBe(60);
    });

    it('7回目以降は最大60秒+jitterで頭打ちになる', () => {
        expect(nextBackoffSeconds(7, 0)).toBe(60);
        expect(nextBackoffSeconds(20, 0.99)).toBeLessThanOrEqual(70);
        expect(nextBackoffSeconds(20, 0.99)).toBeGreaterThanOrEqual(60);
    });

    it('0以下の試行回数を拒否する', () => {
        expect(() => nextBackoffSeconds(0)).toThrow(RangeError);
    });

    it('8回失敗で自動再試行を保留する（削除はしない）', () => {
        expect(shouldSuspendRetry(MAX_SYNC_ATTEMPTS - 1)).toBe(false);
        expect(shouldSuspendRetry(MAX_SYNC_ATTEMPTS)).toBe(true);
    });
});
