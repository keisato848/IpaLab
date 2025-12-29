import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/functions/*.ts'],
    format: ['cjs'],
    target: 'node18',
    clean: true,
    noExternal: ['@ipa-lab/shared'], // Bundle this local package
    splitting: false,
    sourcemap: true,
    outDir: 'dist/src/functions', // Match default output structure
});
