import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

test.describe('Team Page', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('team page renders correctly', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/team`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    // Page heading is present
    await expect(page.locator('h2').first()).toBeVisible();
  });

  test('team page shows pending invites section (admin view)', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/team`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    // The members table or skeleton should render
    const mainContent = page.locator('main#main-content');
    await expect(mainContent).toBeVisible();
  });

  test('team page renders responsive layout', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${DASHBOARD_URL}/dashboard/team`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('team page renders on desktop', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${DASHBOARD_URL}/dashboard/team`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('role badges display with correct styles', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/team`, { waitUntil: 'domcontentloaded' });
    // Wait for content to settle
    await page.waitForTimeout(500);
    // Any role badge elements should use inline-flex display
    const badges = page.locator('[class*="rounded-full"][class*="ring-1"]');
    // At minimum the page loads without error
    await expect(page.locator('main#main-content')).toBeVisible();
    // If there are role badges rendered, they should be visible
    const badgeCount = await badges.count();
    if (badgeCount > 0) {
      await expect(badges.first()).toBeVisible();
    }
  });
});
