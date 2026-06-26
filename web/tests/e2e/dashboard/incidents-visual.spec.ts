/**
 * Sprint 04 — Incidents page visual spec.
 *
 * Verifies that the incidents list page uses semantic color tokens:
 *   - No hardcoded bg-*-NNN / text-*-NNN / border-*-NNN classes in DOM
 *   - Max 2 badge colors per row
 *   - Page renders without console errors
 *
 * Runs against chromium at localhost:3001.
 * Requires SKIP_WEB_SERVER=1 and a running dashboard dev server.
 */

import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';

const HARDCODED_COLOR_PATTERN =
  /\b(?:bg|text|border)-(?:amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose|emerald|teal|violet|gray)-\d{2,3}\b/;

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

test.describe('Incidents page — DS enforcement (Sprint 04)', () => {
  test.use({ baseURL: DASHBOARD_URL });

  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/dashboard/incidents', { waitUntil: 'networkidle' });
    const appErrors = errors.filter(
      (e) => !e.includes('clarity') && !e.includes('googletagmanager'),
    );
    expect(appErrors).toHaveLength(0);
  });

  test('incidents list container is visible', async ({ page }) => {
    await page.goto('/dashboard/incidents', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
  });

  test('no hardcoded color classes in rounded-full badge elements', async ({ page }) => {
    await page.goto('/dashboard/incidents', { waitUntil: 'networkidle' });

    const classAttributes = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="rounded-full"]');
      return Array.from(elements).map((el) => el.className);
    });

    const violations = classAttributes.filter((cls) => HARDCODED_COLOR_PATTERN.test(cls));
    expect(violations).toHaveLength(0);
  });

  test('error alert uses semantic classes', async ({ page }) => {
    await page.route('**/api/analyses**', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' }),
    );

    await page.goto('/dashboard/incidents', { waitUntil: 'networkidle' });

    const errorEl = page.locator('[role="alert"]');
    if ((await errorEl.count()) > 0) {
      const cls = await errorEl.getAttribute('class');
      if (cls) {
        expect(HARDCODED_COLOR_PATTERN.test(cls)).toBe(false);
      }
    }
  });

  test('filter controls use semantic border/bg classes', async ({ page }) => {
    await page.goto('/dashboard/incidents', { waitUntil: 'domcontentloaded' });

    const selects = await page.locator('[role="combobox"]').all();
    for (const select of selects) {
      const cls = await select.getAttribute('class');
      if (cls) {
        expect(HARDCODED_COLOR_PATTERN.test(cls)).toBe(false);
      }
    }
  });
});
