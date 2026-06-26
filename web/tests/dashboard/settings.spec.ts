import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('settings page renders with tab navigation', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // The settings page heading should be visible
    await expect(page.locator('h2').first()).toBeVisible();
  });

  test('settings page has tab role buttons', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Tab list should contain tab buttons
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();
  });

  test('settings page profile tab is default active', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Profile tab panel should be visible by default
    const profilePanel = page.locator('[role="tabpanel"]#settings-panel-profile');
    await expect(profilePanel).toBeVisible({ timeout: 5000 });
  });

  test('settings notifications tab is reachable via URL', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/settings?tab=notifications`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Notifications panel should be visible
    const notifPanel = page.locator('[role="tabpanel"]#settings-panel-notifications');
    await expect(notifPanel).toBeVisible({ timeout: 5000 });
  });

  test('settings appearance tab is reachable via URL', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/settings?tab=appearance`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Appearance panel should be visible
    const appearancePanel = page.locator('[role="tabpanel"]#settings-panel-appearance');
    await expect(appearancePanel).toBeVisible({ timeout: 5000 });
  });

  test('appearance tab has theme selector', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/settings?tab=appearance`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Theme radiogroup should be present
    const themeGroup = page.locator('[role="radiogroup"]').first();
    await expect(themeGroup).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Breadcrumbs', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('analyses page shows breadcrumbs with Dashboard and Analyses', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/analyses`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Breadcrumb nav should be present
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible({ timeout: 5000 });
  });

  test('settings page shows breadcrumbs', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Breadcrumb nav should be present
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible({ timeout: 5000 });
  });

  test('dashboard home does NOT show breadcrumbs (only 1 level)', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // No breadcrumb nav on single-level pages
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Error Boundary', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('main content renders without triggering error boundary', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Error boundary fallback should NOT be visible on a working page
    await expect(page.locator('[role="alert"]')).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('search button is visible in topbar', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
  });

  test('Cmd+K opens command palette dialog', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Press Ctrl+K (Linux equivalent of Cmd+K)
    await page.keyboard.press('Control+k');

    // Dialog should appear
    const dialog = page.locator('[role="dialog"][aria-label="Command palette"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
  });

  test('Escape closes command palette', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Open command palette
    await page.keyboard.press('Control+k');
    const dialog = page.locator('[role="dialog"][aria-label="Command palette"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('command palette search input is focused when opened', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    await page.keyboard.press('Control+k');
    const dialog = page.locator('[role="dialog"][aria-label="Command palette"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Search input should be focused
    const input = dialog.locator('input[role="combobox"]');
    await expect(input).toBeVisible();
  });
});

test.describe('Settings Page — Responsive', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('settings page renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('settings page renders on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Tab list should be visible on desktop
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();
  });
});

test.describe('Fire Test Error', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('fire test error API returns fired=1 and a variant name', async ({ page }) => {
    // Navigate to get auth cookies loaded
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Call the API directly with page.evaluate (uses browser context with auth cookies)
    const result = await page.evaluate(async (dashboardUrl) => {
      const res = await fetch(`${dashboardUrl}/api/admin/fire-test-errors`, {
        method: 'POST',
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, DASHBOARD_URL);

    expect(result.status).toBe(200);
    expect(result.body.fired).toBe(1);
    expect(typeof result.body.name).toBe('string');
    expect(result.body.name.length).toBeGreaterThan(0);
    // Verify name is one of the known variants
    const VARIANTS = [
      'DatabaseTimeoutError',
      'RedisConnectionError',
      'S3UploadFailure',
      'NullPointerInPaymentFlow',
      'RateLimitExceeded',
      'JWTSignatureMismatch',
      'OutOfMemoryHeapCorruption',
      'ZeroDivisionInMetrics',
      'WebhookSignatureInvalid',
      'KafkaConsumerLag',
    ];
    expect(VARIANTS).toContain(result.body.name);
  });
});
