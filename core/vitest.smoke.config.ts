import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/smoke/**/*.smoke.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 120_000,
    setupFiles: ['tests/smoke/setup.ts'],
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
