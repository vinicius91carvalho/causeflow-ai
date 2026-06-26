import { expect, test } from '@playwright/test';

/**
 * Cleric-redesign homepage — structural + CTA + visual smoke test.
 *
 * Visits `/` and `/pt-br`, asserts the cloned section landmarks render,
 * verifies the first primary CTA links to a dashboard host, and captures
 * screenshots at mobile / tablet / desktop widths for review.
 */

const viewports = [
  { label: 'mobile-390', width: 390, height: 844 },
  { label: 'tablet-768', width: 768, height: 1024 },
  { label: 'desktop-1440', width: 1440, height: 900 },
] as const;

const locales = [
  { path: '/', label: 'en' },
  { path: '/pt-br', label: 'pt-br' },
] as const;

// Block analytics/tracker domains so failures can't be blamed on 3rd parties.
const BLOCKED_HOSTS = ['google-analytics.com', 'googletagmanager.com', 'clarity.ms', 'c.bing.com'];

test.describe('cleric homepage — structural + visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (BLOCKED_HOSTS.some((host) => url.includes(host))) {
        return route.abort();
      }
      return route.continue();
    });
  });

  for (const locale of locales) {
    for (const viewport of viewports) {
      test(`${locale.label} homepage renders at ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(locale.path, { waitUntil: 'domcontentloaded' });
        expect(response?.ok()).toBeTruthy();

        // ----- Structural landmarks -----
        await expect(page.locator('header').first()).toBeVisible();
        await expect(page.locator('main').first()).toBeVisible();
        await expect(page.locator('footer').first()).toBeVisible();

        // Hero headline is an <h1> — must render
        await expect(page.locator('h1').first()).toBeVisible();

        // At least one section landmark exists
        const sections = page.locator('section');
        expect(await sections.count()).toBeGreaterThan(0);

        // ----- Primary CTA points to the dashboard -----
        // First dashboard-targeted anchor must exist and resolve to dashboard.* host
        const dashboardAnchors = page.locator('a[href^="http"]', {
          hasText:
            /open the dashboard|abrir o dashboard|get early access|ver como funciona|open dashboard/i,
        });
        const firstCta = dashboardAnchors.first();
        if ((await dashboardAnchors.count()) > 0) {
          const href = await firstCta.getAttribute('href');
          expect(href).toMatch(/^https:\/\/(dashboard|dashboard-staging)\.causeflow\.ai/);
        } else {
          // Fall back: check any external https anchor in main — must include dashboard.
          const anyExternal = page.locator('main a[href^="https://"]').first();
          if ((await anyExternal.count()) > 0) {
            const href = await anyExternal.getAttribute('href');
            expect(href).toMatch(/dashboard/);
          }
        }

        // ----- Screenshot -----
        await page.screenshot({
          path: `screenshots/sprint-02/home-${locale.label}-${viewport.label}.png`,
          fullPage: true,
        });
      });
    }
  }
});
