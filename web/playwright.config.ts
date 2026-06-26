import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const dashboardURL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';
const isExternalTarget = baseURL.startsWith('https://');
// Set SKIP_WEB_SERVER=1 to skip the Playwright webServer block entirely —
// useful when dev servers are already running on a non-default hostname (e.g.
// in PRoot where `localhost` may resolve only to IPv6 `::1` and the webServer
// reuse probe cannot reach them).
const skipWebServer = process.env.SKIP_WEB_SERVER === '1';

// Use local chromium in PRoot, otherwise let Playwright manage the browser
const localChromium = '/usr/bin/chromium';
const launchOptions: Record<string, unknown> = {
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
};
if (existsSync(localChromium)) {
  launchOptions.executablePath = localChromium;
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 3,
  reporter: [['list']],
  timeout: 30000,

  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 10000,
    headless: true,
    launchOptions,
    // Force prefers-reduced-motion so that scroll-triggered animations
    // (AnimateOnScroll) skip their hidden initial state. Without this,
    // elements below the fold start at opacity:0 and only become visible
    // after the IntersectionObserver fires — causing test failures and
    // blank areas in full-page screenshots.
    reducedMotion: 'reduce',
    // Staging uses cookie-based auth via Next.js middleware. Pre-set the
    // staging-authorized cookie so tests bypass the login gate automatically.
    ...(baseURL.includes('staging.causeflow.ai')
      ? {
          storageState: {
            cookies: [
              {
                name: 'staging-authorized',
                value: Buffer.from(
                  `staging-authorized:${process.env.NEXT_PUBLIC_STAGING_PASSWORD || 'causeflow-staging-2026'}`,
                ).toString('base64'),
                domain: 'staging.causeflow.ai',
                path: '/',
                expires: Math.floor(Date.now() / 1000) + 86400,
                httpOnly: false,
                secure: true,
                sameSite: 'Lax' as const,
              },
            ],
            origins: [],
          },
        }
      : {}),
  },

  projects: [
    // --- Website viewport projects (run all website tests across 4 breakpoints) ---
    {
      name: 'chromium-mobile',
      testIgnore: ['**/dashboard/**', '**/e2e/**'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'chromium-tablet',
      testIgnore: ['**/dashboard/**', '**/e2e/**'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'chromium-desktop',
      testIgnore: ['**/dashboard/**', '**/e2e/**'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'chromium-wide',
      testIgnore: ['**/dashboard/**', '**/e2e/**'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },

    // --- Dashboard projects ---
    // Signs in once and saves session state to tests/dashboard/.auth/user.json.
    // auth.spec.ts and onboarding.spec.ts mock their own sessions and remain in
    // the viewport projects above; they are excluded from dashboard-authed.
    {
      name: 'dashboard-setup',
      testDir: './tests/dashboard',
      testMatch: 'auth-setup.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'dashboard-authed',
      dependencies: ['dashboard-setup'],
      testDir: './tests/dashboard',
      testMatch: /^(?!auth\.spec|auth-setup|onboarding\.spec).*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: 'tests/dashboard/.auth/user.json',
      },
    },

    // --- E2E dashboard project for tests/e2e/dashboard/ ---
    // integration-hardening sprint 05 specs (integrations-sentry-setup,
    // integrations-slack-card, settings-fire-test-error-roundtrip) live under
    // tests/e2e/dashboard/. They need the same Clerk-authed session as
    // dashboard-authed but a different testDir.
    {
      name: 'e2e-dashboard-authed',
      dependencies: ['dashboard-setup'],
      testDir: './tests/e2e/dashboard',
      testMatch: /.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: 'tests/dashboard/.auth/user.json',
      },
    },

    // --- Sprint-06b persona review project ---
    // Reuses the dashboard-setup session but targets tests/e2e/review/*.spec.ts.
    {
      name: 'dashboard-review',
      dependencies: ['dashboard-setup'],
      testDir: './tests/e2e/review',
      testMatch: /.*-audit\.spec\.ts$/,
      timeout: 300000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: 'tests/dashboard/.auth/user.json',
        actionTimeout: 30000,
        navigationTimeout: 180000,
      },
    },
  ],

  // Skip webServer when testing against a deployed URL (CI E2E) or when
  // SKIP_WEB_SERVER=1 (local dev with already-running servers).
  ...(isExternalTarget || skipWebServer
    ? {}
    : {
        webServer: [
          {
            command: 'pnpm exec next start -H 127.0.0.1',
            cwd: './apps/website',
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            timeout: 30000,
          },
          {
            command: 'pnpm --filter dashboard exec next start -H 127.0.0.1 -p 3001',
            cwd: './apps/dashboard',
            url: dashboardURL,
            reuseExistingServer: !process.env.CI,
            timeout: 30000,
          },
        ],
      }),
});
