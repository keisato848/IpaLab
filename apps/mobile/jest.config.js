/** Jest設定（詳細設計§12: Unit=Jest、Component=RNTL） */
module.exports = {
    preset: 'jest-expo',
    testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|expo-router|drizzle-orm)',
    ],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**'],
};
