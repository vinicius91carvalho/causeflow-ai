import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/eval/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    setupFiles: ['tests/e2e/setup.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@modules': resolve(__dirname, 'src/modules'),
    },
  },
});
