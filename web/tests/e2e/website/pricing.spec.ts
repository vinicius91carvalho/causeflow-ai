import { expect, test } from '@playwright/test';

const BLOCKED_HOSTS = ['google-analytics.com', 'googletagmanager.com', 'clarity.ms', 'c.bing.com'];

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED_HOSTS.some((host) => url.includes(host))) {
      route.abort();
    } else {
      route.continue();
    }
  });
});

test.describe('/pricing page', () => {
  test('shows $99 Starter plan', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    const body = await page.locator('body').textContent();
    expect(body).toContain('99');
  });

  test('shows $349 Pro plan', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    const body = await page.locator('body').textContent();
    expect(body).toContain('349');
  });

  test('shows $899 Business plan', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    const body = await page.locator('body').textContent();
    expect(body).toContain('899');
  });

  test('at least one CTA links to dashboard', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    const dashboardLinks = page.locator(
      'a[href*="dashboard.causeflow.ai"], a[href*="localhost:3001"]',
    );
    const count = await dashboardLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('pt-br /pricing loads without errors', async ({ page }) => {
    await page.goto('/pt-br/pricing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
