import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    // AC-046 black-box HTTP regression is exercised by `.harness/ac046-verify.sh`
    // (and `pnpm test:e2e tests/e2e/pipeline-local-only-regression.test.ts`).
    // Default `pnpm test:e2e` covers the in-process alert→triage→investigation→
    // remediation flow on the OSS stack (AC-050) without a live Ornith multi-minute run.
    exclude: ['tests/e2e/pipeline-local-only-regression.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
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
