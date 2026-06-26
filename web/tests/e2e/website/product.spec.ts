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

test.describe('/product page', () => {
  test('renders hero section with title', async ({ page }) => {
    await page.goto('/product', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    const text = await h1.textContent();
    expect(text?.length).toBeGreaterThan(5);
  });

  test('has no waitlist or beta contact copy', async ({ page }) => {
    await page.goto('/product', { waitUntil: 'domcontentloaded' });
    const body = await page.locator('body').textContent();
    expect(body?.toLowerCase()).not.toContain('join the waitlist');
    expect(body?.toLowerCase()).not.toContain('contact us for beta');
  });

  test('has at least 4 narrative sections', async ({ page }) => {
    await page.goto('/product', { waitUntil: 'domcontentloaded' });
    const sections = page.locator('section, [id^="phase"], [id^="architecture"]');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('pt-br /product loads without errors', async ({ page }) => {
    await page.goto('/pt-br/product', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
