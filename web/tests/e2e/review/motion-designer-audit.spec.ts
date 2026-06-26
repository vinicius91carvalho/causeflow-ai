/**
 * Motion Designer Audit — website (light theme only).
 *
 * Captures motion-relevant frames per route:
 *   - above-fold initial paint (no scroll)
 *   - mid-page scroll reveal (50% scroll)
 *   - footer/end (scrollToBottom)
 *   - prefers-reduced-motion enabled (proves animations are respectful)
 *
 * Intentionally uses `reducedMotion: 'no-preference'` to capture real motion,
 * separate from the UX smoke spec (which uses reduce).
 *
 * Run:
 *   SKIP_WEB_SERVER=1 BASE_URL=http://127.0.0.1:3000 \
 *   pnpm exec playwright test tests/e2e/review/motion-designer-audit.spec.ts \
 *     --project=chromium-desktop
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/product', '/security', '/integrations', '/use-cases', '/pricing'] as const;

const BLOCKED_HOSTS = ['google-analytics.com', 'googletagmanager.com', 'clarity.ms', 'c.bing.com'];

const SCREENSHOT_DIR = 'screenshots/motion-designer';

async function blockTrackers(page: Page) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED_HOSTS.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });
}

async function snap(page: Page, name: string) {
  await page.waitForTimeout(400); // let raf-paced animations settle in frame
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: false });
}

test.describe.configure({ mode: 'parallel' });

test.describe('motion-designer — full-motion capture', () => {
  test.use({ reducedMotion: 'no-preference' });

  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  for (const route of ROUTES) {
    test(`${route} motion sequence`, async ({ page }) => {
      const safe = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `HTTP ${response?.status()} on ${route}`).toBeTruthy();

      // above-fold initial paint
      await snap(page, `${safe}-t0-above-fold`);

      // mid scroll — reveals scroll-triggered content
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
      await page.waitForTimeout(800);
      await snap(page, `${safe}-t1-mid-scroll`);

      // end of page
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(800);
      await snap(page, `${safe}-t2-footer`);
    });
  }
});

test.describe('motion-designer — reduced-motion respect', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  for (const route of ROUTES) {
    test(`${route} prefers-reduced-motion`, async ({ page }) => {
      const safe = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `HTTP ${response?.status()} on ${route}`).toBeTruthy();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
      await page.waitForTimeout(600);
      await snap(page, `${safe}-reduce-mid`);
    });
  }
});
