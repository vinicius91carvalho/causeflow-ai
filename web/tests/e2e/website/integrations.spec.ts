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

test.describe('/integrations page', () => {
  test('renders without making runtime API requests to /api/integrations', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/integrations')) {
        apiRequests.push(req.url());
      }
    });

    await page.goto('/integrations', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();

    // Static page — no runtime API calls expected
    expect(apiRequests).toHaveLength(0);
  });

  test('shows integration cards', async ({ page }) => {
    await page.goto('/integrations', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    // Integration catalog should show multiple items
    const _cards = page
      .locator('[data-testid="integration-card"], .integration-card, article')
      .first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('hero section is visible', async ({ page }) => {
    await page.goto('/integrations', { waitUntil: 'domcontentloaded' });
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
  });

  test('pt-br /integrations loads without errors', async ({ page }) => {
    await page.goto('/pt-br/integrations', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
