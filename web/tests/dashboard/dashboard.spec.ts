import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

test.describe('Dashboard — Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Block analytics/tracker domains
    await blockTrackers(page);
  });

  test('renders sidebar and topbar on desktop', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('aside[aria-label="Main navigation"]')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
  });

  test('root / redirects to /dashboard', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('sidebar navigation links are present', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await expect(sidebar.locator('a[href="/dashboard"]').first()).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/analyses"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/integrations"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/team"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/settings"]')).toBeVisible();
  });

  test('analyses page loads', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/analyses`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('integrations page loads', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/integrations`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('team page loads', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/team`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
  });
});

test.describe('Dashboard Home — Phase 5 Components', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('dashboard home page renders with heading', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    // Page heading (h1)
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('metrics cards section is present', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    // The metrics section is labeled
    const metricsSection = page.locator('section[aria-label="Key metrics"]');
    await expect(metricsSection).toBeVisible();
  });

  test('credits banner section is present', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    const creditsSection = page.locator('section[aria-label="Credits"]');
    await expect(creditsSection).toBeVisible();
  });

  test('credits banner has upgrade link', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    // Upgrade Plan link exists inside credits section
    const upgradeLink = page.locator('section[aria-label="Credits"] a');
    await expect(upgradeLink).toBeVisible();
  });

  test('empty state shows for new tenant (no analyses)', async ({ page }) => {
    // Block /api/analyses and /api/metrics to simulate new tenant
    await page.route('**/api/metrics', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metrics: {
            totalAnalyses: 0,
            monthlyAnalyses: 0,
            activeIntegrations: 0,
            teamMembers: 1,
            creditsTotal: 100,
            creditsUsed: 0,
            creditsRemaining: 100,
          },
        }),
      }),
    );
    await page.route('**/api/analyses*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ analyses: [], pagination: { hasMore: false, count: 0 } }),
      }),
    );

    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Empty state should appear after loading
    // It has a dashed border and a heading
    await expect(page.locator('.border-dashed')).toBeVisible({ timeout: 10000 });
  });

  test('responsive layout — metrics grid on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    // Metrics section should still be visible on mobile
    await expect(page.locator('section[aria-label="Key metrics"]')).toBeVisible();
  });

  test('responsive layout — metrics grid on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('section[aria-label="Key metrics"]')).toBeVisible();
  });
});

// ─── Mock helpers ──────────────────────────────────────────────────────────────

async function mockMetrics(
  page: import('@playwright/test').Page,
  overrides: Partial<{
    totalAnalyses: number;
    monthlyAnalyses: number;
    activeIntegrations: number;
    teamMembers: number;
    creditsTotal: number;
    creditsUsed: number;
    creditsRemaining: number;
  }> = {},
) {
  await page.route('**/api/metrics', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        metrics: {
          totalAnalyses: 5,
          monthlyAnalyses: 3,
          activeIntegrations: 2,
          teamMembers: 4,
          creditsTotal: 100,
          creditsUsed: 20,
          creditsRemaining: 80,
          ...overrides,
        },
      }),
    }),
  );
}

async function mockAnalyses(
  page: import('@playwright/test').Page,
  analyses: Array<{
    id: string;
    prompt: string;
    status: string;
    severity?: string;
    createdAt: string;
  }> = [],
) {
  await page.route('**/api/analyses*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        analyses,
        pagination: { hasMore: false, count: analyses.length },
      }),
    }),
  );
}

const SAMPLE_ANALYSES = [
  {
    id: 'analysis-1',
    prompt: 'Investigate the API latency spike on production cluster',
    status: 'completed',
    severity: 'high',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
  },
  {
    id: 'analysis-2',
    prompt: 'Database connection pool exhaustion causing 503 errors',
    status: 'running',
    severity: 'critical',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30m ago
  },
  {
    id: 'analysis-3',
    prompt: 'Memory leak in worker service',
    status: 'queued',
    severity: 'medium',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5m ago
  },
];

// ─── Sidebar Navigation Interaction ───────────────────────────────────────────

test.describe('Dashboard — Sidebar Navigation Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('clicking Analyses link in sidebar navigates to /dashboard/analyses', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await sidebar.locator('a[href="/dashboard/analyses"]').click();
    await expect(page).toHaveURL(/\/dashboard\/analyses/);
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('clicking Integrations link in sidebar navigates to /dashboard/integrations', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await sidebar.locator('a[href="/dashboard/integrations"]').click();
    await expect(page).toHaveURL(/\/dashboard\/integrations/);
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('clicking Team link in sidebar navigates to /dashboard/team', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await sidebar.locator('a[href="/dashboard/team"]').click();
    await expect(page).toHaveURL(/\/dashboard\/team/);
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('clicking Settings link in sidebar navigates to /dashboard/settings', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await sidebar.locator('a[href="/dashboard/settings"]').click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('active nav item has aria-current="page" on /dashboard', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    // The overview link should be marked active
    const overviewLink = sidebar.locator('a[href="/dashboard"][aria-current="page"]');
    await expect(overviewLink).toBeVisible();
  });

  test('active nav item changes to analyses when on analyses page', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/analyses`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    const analysesLink = sidebar.locator('a[href="/dashboard/analyses"][aria-current="page"]');
    await expect(analysesLink).toBeVisible();
  });

  test('desktop sidebar can be collapsed via toggle button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    // Sidebar should be expanded (w-64) by default — check the logo text is visible
    await expect(sidebar.locator('text=CauseFlow AI')).toBeVisible();

    // Click collapse button
    const collapseBtn = sidebar.locator(
      'button[aria-label*="Collapse"], button[aria-label*="collapse"]',
    );
    await collapseBtn.click();

    // After collapsing, the "CauseFlow AI" text should no longer be visible
    await expect(sidebar.locator('text=CauseFlow AI')).not.toBeVisible();
  });

  test('desktop sidebar re-expands after collapse', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

    const sidebar = page.locator('aside[aria-label="Main navigation"]');

    // Collapse
    const collapseBtn = sidebar.locator(
      'button[aria-label*="Collapse"], button[aria-label*="collapse"]',
    );
    await collapseBtn.click();
    await expect(sidebar.locator('text=CauseFlow AI')).not.toBeVisible();

    // Expand — button label should now say "Expand"
    const expandBtn = sidebar.locator('button[aria-label*="Expand"], button[aria-label*="expand"]');
    await expandBtn.click();
    await expect(sidebar.locator('text=CauseFlow AI')).toBeVisible();
  });
});

// ─── Mobile Sidebar Toggle ─────────────────────────────────────────────────────

test.describe('Dashboard — Mobile Sidebar Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('sidebar is hidden by default on mobile', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    // On mobile the sidebar starts with -translate-x-full (off-screen)
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    // The sidebar element exists but should be translated off-screen
    await expect(sidebar).toBeInViewport({ ratio: 0 });
  });

  test('hamburger button is visible on mobile', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const hamburger = page.locator('header button[aria-label]').first();
    await expect(hamburger).toBeVisible();
  });

  test('clicking hamburger opens mobile sidebar', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    // The hamburger is the button in the topbar that triggers mobile menu
    const hamburger = header.locator('button').filter({ hasText: '' }).first();
    await hamburger.click();

    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    // Sidebar should now be visible/in-viewport after opening
    await expect(sidebar).toBeVisible();
  });

  test('clicking mobile overlay closes the sidebar', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    const hamburger = header.locator('button').first();
    await hamburger.click();

    // Overlay is the fixed inset-0 div with aria-hidden
    const overlay = page.locator('div[aria-hidden="true"].fixed.inset-0');
    await overlay.click();

    // Sidebar should be off-screen again
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await expect(sidebar).not.toBeInViewport();
  });

  test('clicking close button (X) inside sidebar closes it on mobile', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    const hamburger = header.locator('button').first();
    await hamburger.click();

    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    const closeBtn = sidebar.locator('button[aria-label="Close menu"]');
    await closeBtn.click();

    await expect(sidebar).not.toBeInViewport();
  });
});

// ─── Quick Actions ─────────────────────────────────────────────────────────────

test.describe('Dashboard Home — Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    // Mock data with analyses so quick actions section is rendered
    await mockMetrics(page);
    await mockAnalyses(page, SAMPLE_ANALYSES);
  });

  test('quick actions section is visible when analyses exist', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    const quickActions = page.locator('section[aria-label="Quick actions"]');
    await expect(quickActions).toBeVisible({ timeout: 10000 });
  });

  test('New Analysis quick action link points to /dashboard/analyses/new', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const quickActions = page.locator('section[aria-label="Quick actions"]');
    await expect(quickActions).toBeVisible({ timeout: 10000 });
    const newAnalysisLink = quickActions.locator('a[href="/dashboard/analyses/new"]');
    await expect(newAnalysisLink).toBeVisible();
  });

  test('Connect Integration quick action link points to /dashboard/integrations', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const quickActions = page.locator('section[aria-label="Quick actions"]');
    await expect(quickActions).toBeVisible({ timeout: 10000 });
    const integrationLink = quickActions.locator('a[href="/dashboard/integrations"]');
    await expect(integrationLink).toBeVisible();
  });

  test('clicking New Analysis quick action navigates to /dashboard/analyses/new', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const quickActions = page.locator('section[aria-label="Quick actions"]');
    await expect(quickActions).toBeVisible({ timeout: 10000 });
    await quickActions.locator('a[href="/dashboard/analyses/new"]').click();
    await expect(page).toHaveURL(/\/dashboard\/analyses\/new/);
  });

  test('clicking Connect Integration quick action navigates to /dashboard/integrations', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const quickActions = page.locator('section[aria-label="Quick actions"]');
    await expect(quickActions).toBeVisible({ timeout: 10000 });
    await quickActions.locator('a[href="/dashboard/integrations"]').click();
    await expect(page).toHaveURL(/\/dashboard\/integrations/);
  });

  test('quick actions section is NOT shown when there are no analyses', async ({ page }) => {
    // Override mocks to simulate empty state
    await page.route('**/api/metrics', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metrics: {
            totalAnalyses: 0,
            monthlyAnalyses: 0,
            activeIntegrations: 0,
            teamMembers: 1,
            creditsTotal: 100,
            creditsUsed: 0,
            creditsRemaining: 100,
          },
        }),
      }),
    );
    await page.route('**/api/analyses*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ analyses: [], pagination: { hasMore: false, count: 0 } }),
      }),
    );

    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    // Quick actions should be hidden; empty state should show instead
    await expect(page.locator('section[aria-label="Quick actions"]')).not.toBeVisible();
    await expect(page.locator('.border-dashed')).toBeVisible({ timeout: 10000 });
  });
});

// ─── Recent Analyses with Mocked Data ─────────────────────────────────────────

test.describe('Dashboard Home — Recent Analyses with Mocked Data', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    await mockMetrics(page);
    await mockAnalyses(page, SAMPLE_ANALYSES);
  });

  test('recent analyses section is visible when analyses exist', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const section = page.locator('section[aria-label="Recent analyses"]');
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test('recent analyses list renders analysis items', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const section = page.locator('section[aria-label="Recent analyses"]');
    await expect(section).toBeVisible({ timeout: 10000 });
    // Each analysis appears as a list item link
    const items = section.locator('ul li');
    await expect(items).toHaveCount(3, { timeout: 10000 });
  });

  test('analysis item shows truncated prompt text', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const section = page.locator('section[aria-label="Recent analyses"]');
    await expect(section).toBeVisible({ timeout: 10000 });
    // First analysis prompt should be visible
    await expect(
      section.locator('text=Investigate the API latency spike on production cluster'),
    ).toBeVisible();
  });

  test('analysis item shows status badge', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const section = page.locator('section[aria-label="Recent analyses"]');
    await expect(section).toBeVisible({ timeout: 10000 });
    // Status badges should be rendered (span with rounded-full)
    const badges = section.locator('span.rounded-full');
    await expect(badges.first()).toBeVisible();
  });

  test('clicking an analysis item navigates to the analysis detail page', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const section = page.locator('section[aria-label="Recent analyses"]');
    await expect(section).toBeVisible({ timeout: 10000 });
    // Click the first analysis link
    const firstItem = section.locator('ul li').first();
    await firstItem.locator('a').click();
    await expect(page).toHaveURL(/\/dashboard\/analyses\/analysis-1/);
  });

  test('"View All" link in recent analyses points to /dashboard/analyses', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const section = page.locator('section[aria-label="Recent analyses"]');
    await expect(section).toBeVisible({ timeout: 10000 });
    const viewAllLink = section.locator('a[href="/dashboard/analyses"]');
    await expect(viewAllLink).toBeVisible();
  });

  test('recent analyses section shows "no analyses" message when list is empty but metrics show data', async ({
    page,
  }) => {
    // Override only analyses — metrics still show totalAnalyses > 0 so the section renders
    await page.route('**/api/analyses*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ analyses: [], pagination: { hasMore: false, count: 0 } }),
      }),
    );
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const section = page.locator('section[aria-label="Recent analyses"]');
    await expect(section).toBeVisible({ timeout: 10000 });
    // Empty label text rendered inside the section
    const emptyMsg = section.locator('p.text-sm.text-muted-foreground');
    await expect(emptyMsg).toBeVisible();
  });

  test('metrics cards display mocked values', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    const metricsSection = page.locator('section[aria-label="Key metrics"]');
    await expect(metricsSection).toBeVisible({ timeout: 10000 });
    // Total analyses value from mock = 5
    await expect(metricsSection.locator('p.text-2xl').first()).toHaveText('5', { timeout: 10000 });
  });
});

// ─── Credits Banner Behavior ───────────────────────────────────────────────────

test.describe('Dashboard Home — Credits Banner', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('credits banner upgrade link navigates to /dashboard/settings', async ({ page }) => {
    await mockMetrics(page);
    await mockAnalyses(page);
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const creditsSection = page.locator('section[aria-label="Credits"]');
    await expect(creditsSection).toBeVisible({ timeout: 10000 });
    const upgradeLink = creditsSection.locator('a[href="/dashboard/settings"]');
    await expect(upgradeLink).toBeVisible();
    await upgradeLink.click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test('credits banner shows warning state when < 20% credits remain', async ({ page }) => {
    // 82/100 used = 18% remaining → warning
    await mockMetrics(page, {
      creditsTotal: 100,
      creditsUsed: 82,
      creditsRemaining: 18,
    });
    await mockAnalyses(page);
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const creditsSection = page.locator('section[aria-label="Credits"]');
    await expect(creditsSection).toBeVisible({ timeout: 10000 });
    // Warning state has amber border class
    await expect(creditsSection.locator('section[aria-label="Credits status"]')).toHaveClass(
      /border-amber/,
      { timeout: 10000 },
    );
  });

  test('credits banner shows critical state when < 5% credits remain', async ({ page }) => {
    // 97/100 used = 3% remaining → critical
    await mockMetrics(page, {
      creditsTotal: 100,
      creditsUsed: 97,
      creditsRemaining: 3,
    });
    await mockAnalyses(page);
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const creditsSection = page.locator('section[aria-label="Credits"]');
    await expect(creditsSection).toBeVisible({ timeout: 10000 });
    // Critical state has red border class
    await expect(creditsSection.locator('section[aria-label="Credits status"]')).toHaveClass(
      /border-red/,
      { timeout: 10000 },
    );
  });

  test('credits progress bar has correct aria attributes', async ({ page }) => {
    await mockMetrics(page, {
      creditsTotal: 100,
      creditsUsed: 20,
      creditsRemaining: 80,
    });
    await mockAnalyses(page);
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible({ timeout: 10000 });
    await expect(progressBar).toHaveAttribute('aria-valuenow', '80');
    await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  test('credits "used / total" text is displayed', async ({ page }) => {
    await mockMetrics(page, {
      creditsTotal: 100,
      creditsUsed: 20,
      creditsRemaining: 80,
    });
    await mockAnalyses(page);
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    // "20 / 100 used" should be visible
    await expect(page.locator('text=20 / 100 used')).toBeVisible({ timeout: 10000 });
  });
});

// ─── Topbar Actions ────────────────────────────────────────────────────────────

test.describe('Dashboard — Topbar Actions', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('topbar theme toggle button is visible', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    const themeToggle = header.locator('button[title^="Theme:"]');
    await expect(themeToggle).toBeVisible();
  });

  test('clicking theme toggle cycles color mode (light → dark)', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    const themeToggle = header.locator('button[title^="Theme:"]');

    // Should start in light mode (default)
    await expect(themeToggle).toHaveAttribute('title', 'Theme: light');

    // Click once → dark
    await themeToggle.click();
    await expect(themeToggle).toHaveAttribute('title', 'Theme: dark');
  });

  test('clicking theme toggle again cycles to system mode', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    const themeToggle = header.locator('button[title^="Theme:"]');

    // light → dark → system
    await themeToggle.click();
    await themeToggle.click();
    await expect(themeToggle).toHaveAttribute('title', 'Theme: system');
  });

  test('command palette trigger button is visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    // The search button with keyboard shortcut text is shown on sm+ screens
    const searchBtn = header.locator('button:has-text("Search...")');
    await expect(searchBtn).toBeVisible();
  });

  test('user menu button is visible in topbar', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    // User avatar / initials button (aria-haspopup="menu")
    const userMenuBtn = header.locator('button[aria-haspopup="menu"]');
    await expect(userMenuBtn).toBeVisible();
  });

  test('clicking user menu opens dropdown with settings and sign-out options', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    const userMenuBtn = header.locator('button[aria-haspopup="menu"]');
    await userMenuBtn.click();

    // Dropdown should be visible
    const dropdown = page.locator('[role="menu"]');
    await expect(dropdown).toBeVisible();

    // Sign out button should be inside
    const signOutBtn = dropdown.locator('button[role="menuitem"]');
    await expect(signOutBtn).toBeVisible();
  });

  test('clicking outside user menu closes the dropdown', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    const userMenuBtn = header.locator('button[aria-haspopup="menu"]');
    await userMenuBtn.click();

    // Dropdown is open
    const dropdown = page.locator('[role="menu"]');
    await expect(dropdown).toBeVisible();

    // Click the overlay (fixed inset-0 z-40 div inside user menu area)
    const closeOverlay = page.locator('div.fixed.inset-0.z-40').last();
    await closeOverlay.click();

    await expect(dropdown).not.toBeVisible();
  });
});

// ─── Dark Mode Rendering ───────────────────────────────────────────────────────

test.describe('Dashboard Home — Dark Mode Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    await mockMetrics(page);
    await mockAnalyses(page, SAMPLE_ANALYSES);
  });

  test('switching to dark mode applies .dark class on html element', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    const themeToggle = header.locator('button[title^="Theme:"]');

    // Click to switch to dark
    await themeToggle.click();

    const htmlClass = await page.locator('html').getAttribute('class');
    // html should have "dark" class after switching to dark mode
    expect(htmlClass).toContain('dark');
  });

  test('dashboard layout is still functional in dark mode', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    const themeToggle = header.locator('button[title^="Theme:"]');

    // Switch to dark
    await themeToggle.click();

    // Core layout elements should still be visible
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('aside[aria-label="Main navigation"]')).toBeVisible();
    await expect(page.locator('section[aria-label="Key metrics"]')).toBeVisible();
    await expect(page.locator('section[aria-label="Credits"]')).toBeVisible();
  });

  test('recent analyses section renders correctly in dark mode', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const themeToggle = page.locator('header').locator('button[title^="Theme:"]');
    await themeToggle.click();

    const section = page.locator('section[aria-label="Recent analyses"]');
    await expect(section).toBeVisible({ timeout: 10000 });
    const items = section.locator('ul li');
    await expect(items).toHaveCount(3, { timeout: 10000 });
  });

  test('metrics cards show values in dark mode', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const themeToggle = page.locator('header').locator('button[title^="Theme:"]');
    await themeToggle.click();

    const metricsSection = page.locator('section[aria-label="Key metrics"]');
    await expect(metricsSection).toBeVisible({ timeout: 10000 });
    // 4 metric cards should still show their values
    await expect(metricsSection.locator('p.text-2xl')).toHaveCount(4, { timeout: 10000 });
  });
});
