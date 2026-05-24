import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'node',
        environmentMatchGlobs: [
            // コンポーネント / hooks / app テストは DOM が必要なため happy-dom を使用
            ['**/__tests__/components/**', 'happy-dom'],
            ['**/__tests__/hooks/**', 'happy-dom'],
            ['**/__tests__/app/**', 'happy-dom'],
        ],
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        testTimeout: 30000, // API の動的インポート（CosmosDB SDK 等）が重い場合の対応
        pool: 'threads',
        maxWorkers: 4, // devcontainer / pre-push で worker 起動タイムアウトを避ける
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['node_modules', '.next', 'e2e'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                '.next/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/vitest.setup.ts',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            '@ipa-lab/shared': path.resolve(__dirname, '../../packages/shared/src'),
            // next/server の CJS require が Node.js イベントループに残存ハンドルを作り
            // vitest ワーカーが起動タイムアウトになる問題を回避するため mock にリダイレクト
            'next/server': path.resolve(__dirname, './__mocks__/next/server.ts'),
        },
    },
});
