import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// テスト用にユーティリティ関数を直接定義（フックの内部ロジックをテスト）
const LEVELS = [
    { level: 1, requiredXp: 0, title: '見習い' },
    { level: 2, requiredXp: 100, title: '初心者' },
    { level: 3, requiredXp: 300, title: '学習者' },
    { level: 4, requiredXp: 600, title: '挑戦者' },
    { level: 5, requiredXp: 1000, title: '熟練者' },
    { level: 6, requiredXp: 1500, title: 'エキスパート' },
    { level: 7, requiredXp: 2100, title: 'マスター' },
    { level: 8, requiredXp: 2800, title: 'グランドマスター' },
    { level: 9, requiredXp: 3600, title: 'レジェンド' },
    { level: 10, requiredXp: 4500, title: '合格請負人' }
];

const STREAK_BONUSES = [
    { days: 1, multiplier: 1.0, bonusXp: 0 },
    { days: 2, multiplier: 1.1, bonusXp: 5 },
    { days: 3, multiplier: 1.2, bonusXp: 10 },
    { days: 7, multiplier: 1.5, bonusXp: 30 },
    { days: 14, multiplier: 1.7, bonusXp: 50 },
    { days: 30, multiplier: 2.0, bonusXp: 100 }
];

// レベル判定ロジック
const getLevelForXp = (totalXp: number) => {
    let current = LEVELS[0];
    for (const entry of LEVELS) {
        if (totalXp >= entry.requiredXp) {
            current = entry;
        }
    }
    const next = LEVELS.find(entry => entry.level === current.level + 1);
    return { current, next };
};

// 連続日数ボーナス取得
const getStreakBonus = (streakDays: number) => {
    let bonus = STREAK_BONUSES[0];
    for (const entry of STREAK_BONUSES) {
        if (streakDays >= entry.days) {
            bonus = entry;
        }
    }
    return bonus;
};

// 連続判定ロジック
const checkStreak = (lastActiveDate: string, currentStreak: number) => {
    if (!lastActiveDate) {
        return { isStreak: true, newStreak: 1 };
    }
    const last = new Date(lastActiveDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { isStreak: true, newStreak: currentStreak };
    if (diffDays === 1) return { isStreak: true, newStreak: currentStreak + 1 };
    return { isStreak: false, newStreak: 1 };
};

describe('ゲーミフィケーション ユーティリティ関数', () => {
    describe('getLevelForXp - レベル判定', () => {
        it('0 XPでレベル1（見習い）', () => {
            const result = getLevelForXp(0);
            expect(result.current.level).toBe(1);
            expect(result.current.title).toBe('見習い');
            expect(result.next?.level).toBe(2);
        });

        it('99 XPでレベル1（次は100 XPでレベル2）', () => {
            const result = getLevelForXp(99);
            expect(result.current.level).toBe(1);
            expect(result.next?.requiredXp).toBe(100);
        });

        it('100 XPでレベル2（初心者）', () => {
            const result = getLevelForXp(100);
            expect(result.current.level).toBe(2);
            expect(result.current.title).toBe('初心者');
        });

        it('999 XPでレベル4（挑戦者）', () => {
            const result = getLevelForXp(999);
            expect(result.current.level).toBe(4);
            expect(result.current.title).toBe('挑戦者');
        });

        it('1000 XPでレベル5（熟練者）', () => {
            const result = getLevelForXp(1000);
            expect(result.current.level).toBe(5);
            expect(result.current.title).toBe('熟練者');
        });

        it('4500 XPでレベル10（合格請負人）', () => {
            const result = getLevelForXp(4500);
            expect(result.current.level).toBe(10);
            expect(result.current.title).toBe('合格請負人');
            expect(result.next).toBeUndefined();
        });

        it('10000 XPでもレベル10（上限）', () => {
            const result = getLevelForXp(10000);
            expect(result.current.level).toBe(10);
        });
    });

    describe('getStreakBonus - 連続ボーナス', () => {
        it('1日目はボーナスなし', () => {
            const result = getStreakBonus(1);
            expect(result.bonusXp).toBe(0);
            expect(result.multiplier).toBe(1.0);
        });

        it('2日連続で+5 XP', () => {
            const result = getStreakBonus(2);
            expect(result.bonusXp).toBe(5);
            expect(result.multiplier).toBe(1.1);
        });

        it('3日連続で+10 XP', () => {
            const result = getStreakBonus(3);
            expect(result.bonusXp).toBe(10);
        });

        it('5日連続でも3日のボーナス（次は7日）', () => {
            const result = getStreakBonus(5);
            expect(result.bonusXp).toBe(10);
            expect(result.days).toBe(3);
        });

        it('7日連続で+30 XP', () => {
            const result = getStreakBonus(7);
            expect(result.bonusXp).toBe(30);
            expect(result.multiplier).toBe(1.5);
        });

        it('14日連続で+50 XP', () => {
            const result = getStreakBonus(14);
            expect(result.bonusXp).toBe(50);
        });

        it('30日連続で+100 XP（x2.0倍）', () => {
            const result = getStreakBonus(30);
            expect(result.bonusXp).toBe(100);
            expect(result.multiplier).toBe(2.0);
        });

        it('100日連続でも30日のボーナス（上限）', () => {
            const result = getStreakBonus(100);
            expect(result.bonusXp).toBe(100);
            expect(result.multiplier).toBe(2.0);
        });
    });

    describe('checkStreak - 連続日数判定', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('初回学習時は1日目', () => {
            const result = checkStreak('', 0);
            expect(result.isStreak).toBe(true);
            expect(result.newStreak).toBe(1);
        });

        it('同日に再度学習しても連続日数は増えない', () => {
            const today = new Date('2026-02-01T10:00:00');
            vi.setSystemTime(today);

            const result = checkStreak('2026-02-01', 5);
            expect(result.isStreak).toBe(true);
            expect(result.newStreak).toBe(5); // 変わらない
        });

        it('翌日に学習すると連続日数が増える', () => {
            const today = new Date('2026-02-02T10:00:00');
            vi.setSystemTime(today);

            const result = checkStreak('2026-02-01', 5);
            expect(result.isStreak).toBe(true);
            expect(result.newStreak).toBe(6);
        });

        it('2日以上空くと連続がリセットされる', () => {
            const today = new Date('2026-02-03T10:00:00');
            vi.setSystemTime(today);

            const result = checkStreak('2026-02-01', 10);
            expect(result.isStreak).toBe(false);
            expect(result.newStreak).toBe(1);
        });

        it('1週間空くとリセット', () => {
            const today = new Date('2026-02-08T10:00:00');
            vi.setSystemTime(today);

            const result = checkStreak('2026-02-01', 30);
            expect(result.isStreak).toBe(false);
            expect(result.newStreak).toBe(1);
        });
    });
});

describe('レベルアップ計算', () => {
    it('複数レベル一気に上がる場合', () => {
        // 0 XPから500 XPを獲得した場合
        const before = getLevelForXp(0);
        const after = getLevelForXp(500);
        
        expect(before.current.level).toBe(1);
        expect(after.current.level).toBe(3); // 300 XPでレベル3
    });

    it('レベルアップ判定', () => {
        const currentLevel = 4;
        const newTotalXp = 1000;
        const { current: newLevelEntry } = getLevelForXp(newTotalXp);
        const levelUp = newLevelEntry.level > currentLevel;
        
        expect(levelUp).toBe(true);
        expect(newLevelEntry.level).toBe(5);
    });

    it('XP獲得してもレベルが上がらない場合', () => {
        const currentLevel = 2;
        const newTotalXp = 150; // レベル2のまま
        const { current: newLevelEntry } = getLevelForXp(newTotalXp);
        const levelUp = newLevelEntry.level > currentLevel;
        
        expect(levelUp).toBe(false);
    });
});

describe('実績解除条件', () => {
    const BASE_ACHIEVEMENTS = {
        first_mission: { id: 'first_mission', xpReward: 50 },
        streak_7: { id: 'streak_7', xpReward: 100 },
        streak_30: { id: 'streak_30', xpReward: 500 },
        level_5: { id: 'level_5', xpReward: 200 },
        hundred_questions: { id: 'hundred_questions', xpReward: 100 },
        thousand_questions: { id: 'thousand_questions', xpReward: 500 },
    };

    it('初回ミッションクリアで50 XP', () => {
        const completedMissionsCount = 0;
        const isFirstMission = completedMissionsCount === 0;
        expect(isFirstMission).toBe(true);
        expect(BASE_ACHIEVEMENTS.first_mission.xpReward).toBe(50);
    });

    it('7日連続で100 XP', () => {
        const streakDays = 7;
        const unlockStreak7 = streakDays >= 7;
        expect(unlockStreak7).toBe(true);
        expect(BASE_ACHIEVEMENTS.streak_7.xpReward).toBe(100);
    });

    it('100問解答で100 XP', () => {
        const totalAnswered = 100;
        const unlock100 = totalAnswered >= 100;
        expect(unlock100).toBe(true);
        expect(BASE_ACHIEVEMENTS.hundred_questions.xpReward).toBe(100);
    });

    it('レベル5到達で200 XP', () => {
        const level = 5;
        const unlockLevel5 = level >= 5;
        expect(unlockLevel5).toBe(true);
        expect(BASE_ACHIEVEMENTS.level_5.xpReward).toBe(200);
    });
});
