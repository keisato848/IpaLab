import { useCallback, useEffect, useMemo, useState } from 'react';
import { Achievement, UserAchievements, UserProgress } from '@/lib/api';

const STORAGE_KEY = 'userProgress';
const ACHIEVEMENTS_KEY = 'achievements';

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

const BASE_ACHIEVEMENTS: Record<string, Achievement> = {
    first_mission: {
        id: 'first_mission',
        name: '初めの一歩',
        description: '初回ミッションクリア',
        iconEmoji: '👣',
        xpReward: 50
    },
    streak_7: {
        id: 'streak_7',
        name: '一週間の継続',
        description: '7日連続学習',
        iconEmoji: '🔥',
        xpReward: 100
    },
    streak_30: {
        id: 'streak_30',
        name: '月間マスター',
        description: '30日連続学習',
        iconEmoji: '🏆',
        xpReward: 500
    },
    level_5: {
        id: 'level_5',
        name: '熟練者への道',
        description: 'レベル5到達',
        iconEmoji: '⭐',
        xpReward: 200
    },
    perfect_day: {
        id: 'perfect_day',
        name: 'パーフェクトデイ',
        description: '1日で全問正解',
        iconEmoji: '💯',
        xpReward: 150
    },
    exam_complete: {
        id: 'exam_complete',
        name: '模試完走',
        description: '模擬試験を1回完走',
        iconEmoji: '📝',
        xpReward: 200
    },
    hundred_questions: {
        id: 'hundred_questions',
        name: '百問突破',
        description: '累計100問解答',
        iconEmoji: '💡',
        xpReward: 100
    },
    thousand_questions: {
        id: 'thousand_questions',
        name: '千問の壁',
        description: '累計1000問解答',
        iconEmoji: '🏔️',
        xpReward: 500
    }
};

const DEFAULT_PROGRESS: UserProgress = {
    totalXp: 0,
    currentLevel: 1,
    completedMissions: [],
    streakDays: 0,
    lastActiveDate: ''
};

const DEFAULT_ACHIEVEMENTS: UserAchievements = {
    unlocked: [],
    progress: {}
};

const isClient = () => typeof window !== 'undefined';

const getLevelForXp = (totalXp: number) => {
    let current = LEVELS[0];
    for (const entry of LEVELS) {
        if (totalXp >= entry.requiredXp) {
            current = entry;
        }
    }
    const next = LEVELS.find(entry => entry.level === current.level + 1);
    return {
        current,
        next
    };
};

const getStreakBonus = (streakDays: number) => {
    let bonus = STREAK_BONUSES[0];
    for (const entry of STREAK_BONUSES) {
        if (streakDays >= entry.days) {
            bonus = entry;
        }
    }
    return bonus;
};

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

const loadFromStorage = <T,>(key: string, fallback: T): T => {
    if (!isClient()) return fallback;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch (error) {
        console.error(`Failed to parse ${key}`, error);
        return fallback;
    }
};

const saveToStorage = (key: string, value: unknown) => {
    if (!isClient()) return;
    localStorage.setItem(key, JSON.stringify(value));
};

const createCategoryAchievement = (category: string): Achievement => ({
    id: `category_master_${category}`,
    name: `${category}マスター`,
    description: `特定カテゴリ正答率90%以上`,
    iconEmoji: '🏅',
    xpReward: 300
});

const isAchievementUnlocked = (achievementId: string, achievements: UserAchievements) =>
    achievements.unlocked.some(entry => entry.id === achievementId);

export interface MissionCompletionMetrics {
    todayRecords?: { isCorrect: boolean; category?: string }[];
    totalAnswered?: number;
    categoryAccuracy?: Record<string, number>;
}

export interface MissionCompletionResult {
    alreadyCompleted: boolean;
    xpEarned: number;
    bonusXp: number;
    achievementXp: number;
    totalXpEarned: number;
    streakDays: number;
    levelUp: boolean;
    newLevel: number;
    unlockedAchievements: Achievement[];
}

export interface LevelUpInfo {
    level: number;
    title: string;
}

export function useUserProgress() {
    const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
    const [achievements, setAchievements] = useState<UserAchievements>(DEFAULT_ACHIEVEMENTS);
    const [lastMissionReward, setLastMissionReward] = useState<MissionCompletionResult | null>(null);
    const [lastLevelUp, setLastLevelUp] = useState<LevelUpInfo | null>(null);

    useEffect(() => {
        if (!isClient()) return;
        setProgress(loadFromStorage<UserProgress>(STORAGE_KEY, DEFAULT_PROGRESS));
        setAchievements(loadFromStorage<UserAchievements>(ACHIEVEMENTS_KEY, DEFAULT_ACHIEVEMENTS));
    }, []);

    const levelInfo = useMemo(() => {
        const { current, next } = getLevelForXp(progress.totalXp);
        const nextRequired = next?.requiredXp ?? current.requiredXp;
        const currentRequired = current.requiredXp;
        const span = Math.max(1, nextRequired - currentRequired);
        const progressValue = Math.min(1, (progress.totalXp - currentRequired) / span);
        return {
            level: current.level,
            title: current.title,
            currentXp: progress.totalXp,
            nextLevelXp: nextRequired,
            xpToNext: Math.max(0, nextRequired - progress.totalXp),
            progressPercent: Math.round(progressValue * 100)
        };
    }, [progress.totalXp]);

    const persistProgress = useCallback((next: UserProgress) => {
        saveToStorage(STORAGE_KEY, next);
        setProgress(next);
    }, []);

    const persistAchievements = useCallback((next: UserAchievements) => {
        saveToStorage(ACHIEVEMENTS_KEY, next);
        setAchievements(next);
    }, []);

    const completeMission = useCallback((params: {
        date: string;
        planId: string;
        missionTitle: string;
        baseXp: number;
        metrics?: MissionCompletionMetrics;
    }): MissionCompletionResult => {
        const storedProgress = loadFromStorage<UserProgress>(STORAGE_KEY, DEFAULT_PROGRESS);
        const storedAchievements = loadFromStorage<UserAchievements>(ACHIEVEMENTS_KEY, DEFAULT_ACHIEVEMENTS);

        if (storedProgress.completedMissions.some(entry => entry.date === params.date && entry.planId === params.planId)) {
            return {
                alreadyCompleted: true,
                xpEarned: 0,
                bonusXp: 0,
                achievementXp: 0,
                totalXpEarned: 0,
                streakDays: storedProgress.streakDays,
                levelUp: false,
                newLevel: storedProgress.currentLevel,
                unlockedAchievements: []
            };
        }

        const { newStreak } = checkStreak(storedProgress.lastActiveDate, storedProgress.streakDays);
        const streakBonus = getStreakBonus(newStreak);
        const baseXp = Math.max(0, Math.floor(params.baseXp));
        const bonusXp = streakBonus.bonusXp;

        const unlocked: Achievement[] = [];
        const nextAchievements: UserAchievements = {
            unlocked: [...storedAchievements.unlocked],
            progress: { ...storedAchievements.progress }
        };

        const unlockAchievement = (achievement: Achievement) => {
            if (isAchievementUnlocked(achievement.id, nextAchievements)) return;
            const unlockedAchievement = { ...achievement, unlockedAt: new Date().toISOString() };
            nextAchievements.unlocked.push(unlockedAchievement);
            unlocked.push(unlockedAchievement);
        };

        const totalAnswered = params.metrics?.totalAnswered ?? storedAchievements.progress.totalAnswered ?? 0;
        if (totalAnswered) {
            nextAchievements.progress.hundred_questions = Math.min(totalAnswered, 100);
            nextAchievements.progress.thousand_questions = Math.min(totalAnswered, 1000);
            nextAchievements.progress.totalAnswered = totalAnswered;
        }

        if (storedProgress.completedMissions.length === 0) {
            unlockAchievement(BASE_ACHIEVEMENTS.first_mission);
        }
        if (newStreak >= 7) {
            unlockAchievement(BASE_ACHIEVEMENTS.streak_7);
        }
        if (newStreak >= 30) {
            unlockAchievement(BASE_ACHIEVEMENTS.streak_30);
        }

        const todayRecords = params.metrics?.todayRecords ?? [];
        if (todayRecords.length > 0 && todayRecords.every(record => record.isCorrect)) {
            unlockAchievement(BASE_ACHIEVEMENTS.perfect_day);
        }

        if (totalAnswered >= 100) {
            unlockAchievement(BASE_ACHIEVEMENTS.hundred_questions);
        }
        if (totalAnswered >= 1000) {
            unlockAchievement(BASE_ACHIEVEMENTS.thousand_questions);
        }

        const categoryAccuracy = params.metrics?.categoryAccuracy ?? {};
        Object.entries(categoryAccuracy).forEach(([category, accuracy]) => {
            if (accuracy >= 0.9) {
                unlockAchievement(createCategoryAchievement(category));
            }
            nextAchievements.progress[`category_master_${category}`] = Math.round(accuracy * 100);
        });

        let achievementXp = unlocked.reduce((sum, achievement) => sum + achievement.xpReward, 0);
        const preLevelTotalXp = storedProgress.totalXp + baseXp + bonusXp + achievementXp;
        const { current: preLevelEntry } = getLevelForXp(preLevelTotalXp);
        if (preLevelEntry.level >= 5) {
            unlockAchievement(BASE_ACHIEVEMENTS.level_5);
            achievementXp = unlocked.reduce((sum, achievement) => sum + achievement.xpReward, 0);
        }

        const totalXpEarned = baseXp + bonusXp + achievementXp;
        const newTotalXp = storedProgress.totalXp + totalXpEarned;
        const { current: newLevelEntry } = getLevelForXp(newTotalXp);
        const levelUp = newLevelEntry.level > storedProgress.currentLevel;

        const nextProgress: UserProgress = {
            ...storedProgress,
            totalXp: newTotalXp,
            currentLevel: newLevelEntry.level,
            streakDays: newStreak,
            lastActiveDate: new Date().toISOString(),
            completedMissions: [
                ...storedProgress.completedMissions,
                {
                    date: params.date,
                    planId: params.planId,
                    xpEarned: totalXpEarned,
                    missionTitle: params.missionTitle
                }
            ]
        };

        persistProgress(nextProgress);
        persistAchievements(nextAchievements);

        const result: MissionCompletionResult = {
            alreadyCompleted: false,
            xpEarned: baseXp,
            bonusXp,
            achievementXp,
            totalXpEarned,
            streakDays: newStreak,
            levelUp,
            newLevel: newLevelEntry.level,
            unlockedAchievements: unlocked
        };

        setLastMissionReward(result);
        if (levelUp) {
            setLastLevelUp({ level: newLevelEntry.level, title: newLevelEntry.title });
        }

        return result;
    }, [persistAchievements, persistProgress]);

    const updateAchievementProgress = useCallback((metrics: MissionCompletionMetrics) => {
        const storedAchievements = loadFromStorage<UserAchievements>(ACHIEVEMENTS_KEY, DEFAULT_ACHIEVEMENTS);
        const nextAchievements: UserAchievements = {
            unlocked: [...storedAchievements.unlocked],
            progress: { ...storedAchievements.progress }
        };

        if (metrics.totalAnswered !== undefined) {
            nextAchievements.progress.hundred_questions = Math.min(metrics.totalAnswered, 100);
            nextAchievements.progress.thousand_questions = Math.min(metrics.totalAnswered, 1000);
            nextAchievements.progress.totalAnswered = metrics.totalAnswered;
        }

        if (metrics.categoryAccuracy) {
            Object.entries(metrics.categoryAccuracy).forEach(([category, accuracy]) => {
                nextAchievements.progress[`category_master_${category}`] = Math.round(accuracy * 100);
            });
        }

        persistAchievements(nextAchievements);
    }, [persistAchievements]);

    const grantAchievement = useCallback((achievementId: string) => {
        const storedProgress = loadFromStorage<UserProgress>(STORAGE_KEY, DEFAULT_PROGRESS);
        const storedAchievements = loadFromStorage<UserAchievements>(ACHIEVEMENTS_KEY, DEFAULT_ACHIEVEMENTS);
        if (isAchievementUnlocked(achievementId, storedAchievements)) return;

        const achievement = BASE_ACHIEVEMENTS[achievementId];
        if (!achievement) return;

        const unlockedAchievement = { ...achievement, unlockedAt: new Date().toISOString() };
        const nextAchievements: UserAchievements = {
            unlocked: [...storedAchievements.unlocked, unlockedAchievement],
            progress: { ...storedAchievements.progress }
        };
        const newTotalXp = storedProgress.totalXp + achievement.xpReward;
        const { current: newLevelEntry } = getLevelForXp(newTotalXp);
        const levelUp = newLevelEntry.level > storedProgress.currentLevel;

        const nextProgress: UserProgress = {
            ...storedProgress,
            totalXp: newTotalXp,
            currentLevel: newLevelEntry.level
        };

        persistAchievements(nextAchievements);
        persistProgress(nextProgress);

        if (levelUp) {
            setLastLevelUp({ level: newLevelEntry.level, title: newLevelEntry.title });
        }
    }, [persistAchievements, persistProgress]);

    const clearMissionReward = useCallback(() => setLastMissionReward(null), []);
    const clearLevelUp = useCallback(() => setLastLevelUp(null), []);

    return {
        progress,
        achievements,
        levelInfo,
        achievementTotal: Object.keys(BASE_ACHIEVEMENTS).length,
        completeMission,
        updateAchievementProgress,
        grantAchievement,
        lastMissionReward,
        lastLevelUp,
        clearMissionReward,
        clearLevelUp
    };
}
