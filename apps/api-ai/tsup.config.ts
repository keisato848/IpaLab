import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/functions/*.ts'],
    format: ['cjs'],
    target: 'node20',
    clean: true,
    splitting: false,
    sourcemap: true,
    outDir: 'dist/src/functions',
});
