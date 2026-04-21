import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        testTimeout: 30000, // API の動的インポート（CosmosDB SDK 等）が重い場合の対応
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
        },
    },
});
