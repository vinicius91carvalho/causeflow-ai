import { expect, test } from '@playwright/test';

const BLOCKED_HOSTS = ['google-analytics.com', 'googletagmanager.com', 'clarity.ms', 'c.bing.com'];
const DOCS_URL = 'https://vinicius91carvalho.github.io/causeflow-ai/docs/';

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

test.describe('/pricing redirect (AC-078)', () => {
  test('redirects /pricing to published docs', async ({ page }) => {
    const res = await page.request.get('/pricing', { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers().location).toBe(DOCS_URL);

    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/vinicius91carvalho\.github\.io\/causeflow-ai/);
    await expect(page.getByText(/\$99|\$349|\$899/)).toHaveCount(0);
  });

  test('redirects /pt-br/pricing to published docs', async ({ page }) => {
    const res = await page.request.get('/pt-br/pricing', { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers().location).toBe(DOCS_URL);

    await page.goto('/pt-br/pricing', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/vinicius91carvalho\.github\.io\/causeflow-ai/);
  });
});
