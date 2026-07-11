import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const websitePort = process.env.PLAYWRIGHT_WEBSITE_PORT || '3000';
const dashboardPort = process.env.PLAYWRIGHT_DASHBOARD_PORT || '3001';
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${websitePort}`;
const dashboardURL = process.env.DASHBOARD_URL || `http://127.0.0.1:${dashboardPort}`;
const isExternalTarget = baseURL.startsWith('https://');
const enableDashboard = process.env.PLAYWRIGHT_DASHBOARD_WEBSERVER === '1';
// OSS compose E2E (AC-054): dashboard host :3001, Core host :3099.
// Always selectable via `--project=dashboard-oss-e2e` (no PLAYWRIGHT_DASHBOARD_WEBSERVER gate).
const isOssE2eProject =
  process.env.PLAYWRIGHT_OSS === '1' ||
  process.argv.some((arg) => arg === 'dashboard-oss-e2e' || arg.includes('dashboard-oss-e2e'));
const ossDashboardURL = process.env.OSS_DASHBOARD_URL || 'http://127.0.0.1:3001';
// Set SKIP_WEB_SERVER=1 to skip the Playwright webServer block entirely —
// useful when dev servers are already running on a non-default hostname (e.g.
// in PRoot where `localhost` may resolve only to IPv6 `::1` and the webServer
// reuse probe cannot reach them).
// OSS compose already serves the dashboard — never spin up the website webServer.
const skipWebServer = process.env.SKIP_WEB_SERVER === '1' || isOssE2eProject;

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

    // --- Dashboard projects (opt-in via PLAYWRIGHT_DASHBOARD_WEBSERVER=1) ---
    ...(enableDashboard
      ? [
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
        ]
      : []),

    // --- OSS compose E2E (AC-054..AC-061): Core local auth, no Clerk / .env.staging ---
    // Only registered when explicitly selected so default website E2E stays green
    // without docker compose. Goal Review gate (AC-061 capstone):
    //   pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-061-capstone.spec.ts
    // Full OSS suite (AC-055..AC-061):
    //   pnpm exec playwright test --project=dashboard-oss-e2e
    ...(isOssE2eProject
      ? [
          {
            name: 'dashboard-oss-setup',
            testDir: './tests/oss',
            testMatch: 'auth-setup.ts',
            use: {
              ...devices['Desktop Chrome'],
              baseURL: ossDashboardURL,
            },
          },
          {
            name: 'dashboard-oss-e2e',
            dependencies: ['dashboard-oss-setup'],
            testDir: './tests/oss',
            testMatch: /.*\.spec\.ts$/,
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 1280, height: 800 },
              baseURL: ossDashboardURL,
              storageState: 'tests/oss/.auth/user.json',
            },
          },
        ]
      : []),
  ],

  // Skip webServer when testing against a deployed URL (CI E2E) or when
  // SKIP_WEB_SERVER=1 (local dev with already-running servers).
  ...(isExternalTarget || skipWebServer
    ? {}
    : {
        webServer: [
          {
            command: `bash -c 'NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3001 pnpm --filter website build && cd apps/website && PORT=${websitePort} pnpm exec next start -H 127.0.0.1 -p ${websitePort}'`,
            cwd: '.',
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
          },
          ...(enableDashboard
            ? [
                {
                  command: `pnpm exec next start -H 127.0.0.1 -p ${dashboardPort}`,
                  cwd: './apps/dashboard',
                  url: `${dashboardURL}/api/health`,
                  reuseExistingServer: !process.env.CI,
                  timeout: 30000,
                },
              ]
            : []),
        ],
      }),
});
