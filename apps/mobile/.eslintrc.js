/** ESLint設定（品質基準: any禁止・エラー0） */
module.exports = {
    root: true,
    extends: ['expo', 'prettier'],
    plugins: ['@typescript-eslint'],
    parser: '@typescript-eslint/parser',
    rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
    ignorePatterns: ['node_modules', '.expo', 'dist'],
};
