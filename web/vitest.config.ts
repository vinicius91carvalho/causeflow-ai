import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: './packages/shared',
          include: ['**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'forms',
          root: './packages/forms',
          include: ['**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'analytics',
          root: './packages/analytics',
          include: ['**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'auth',
          root: './packages/auth',
          include: ['**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'ui',
          root: './packages/ui',
          include: ['**/*.test.ts', '**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'website',
          root: './apps/website',
          include: ['**/*.test.ts', '**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'apps/dashboard/src'),
          },
        },
        test: {
          name: 'dashboard',
          root: './apps/dashboard',
          include: ['**/*.test.ts', '**/*.test.tsx'],
          environment: 'node',
          testTimeout: 15000,
        },
      },
    ],
    pool: 'forks',
    // AC-039 requires `poolOptions: { forks: { maxForks: 3 } }` (vitest 3 syntax).
    // Vitest 4 removed `test.poolOptions` (deprecated) and reads `maxWorkers` for
    // enforcement, so both are kept: poolOptions satisfies the AC text, maxWorkers
    // enforces the max-3 cap at runtime under vitest 4.0.18.
    poolOptions: { forks: { maxForks: 3 } },
    maxWorkers: 3,
    reporters: ['default'],
    passWithNoTests: true,
  },
});
