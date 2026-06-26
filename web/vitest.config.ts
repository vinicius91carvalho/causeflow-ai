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
          // AWS SDK + Stripe + Clerk imports are heavy under PRoot/ARM64.
          // Several billing/integrations tests need ~20-30s for first import.
          testTimeout: 60000,
        },
      },
    ],
    pool: 'forks',
    maxWorkers: 3,
    reporters: ['default'],
    passWithNoTests: true,
  },
});
