import { expect, test } from '@playwright/test';

/**
 * Sprint 05 — Persona baseline smoke.
 *
 * Reusable Playwright harness for the UX Designer + Tech Manager personas.
 * Walks the public marketing funnel + dashboard sign-in landing, captures
 * full-page screenshots at 3 viewports, and records any console errors.
 *
 * Dashboard deep-happy-path is out of scope here — that requires Clerk
 * auth setup (see tests/dashboard/auth-setup.ts). Personas run deeper
 * flows via standalone scripts.
 */

const viewports = [
  { label: 'mobile-390', width: 390, height: 844 },
  { label: 'tablet-768', width: 768, height: 1024 },
  { label: 'desktop-1440', width: 1440, height: 900 },
] as const;

const websiteRoutes = [
  '/',
  '/product',
  '/security',
  '/integrations',
  '/use-cases',
  '/pricing',
  '/privacy',
  '/terms',
] as const;

const ptRoutes = websiteRoutes.map((r) => (r === '/' ? '/pt-br' : `/pt-br${r}`));

const BLOCKED_HOSTS = ['google-analytics.com', 'googletagmanager.com', 'clarity.ms', 'c.bing.com'];

const dashboardBase = process.env.DASHBOARD_URL || 'http://localhost:3001';

test.describe('sprint-05 persona smoke — public website funnel', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (BLOCKED_HOSTS.some((host) => url.includes(host))) {
        return route.abort();
      }
      return route.continue();
    });
  });

  for (const route of [...websiteRoutes, ...ptRoutes]) {
    for (const viewport of viewports) {
      test(`${route} @ ${viewport.label}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
        page.on('console', (msg) => {
          if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
        });

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.ok(), `HTTP ${response?.status()} at ${route}`).toBeTruthy();

        await expect(page.locator('header').first()).toBeVisible();
        await expect(page.locator('main').first()).toBeVisible();
        await expect(page.locator('footer').first()).toBeVisible();
        await expect(page.locator('h1').first()).toBeVisible();

        const safeRoute = route.replace(/\//g, '_').replace(/^_/, '') || 'home';
        await page.screenshot({
          path: `screenshots/sprint-05/website${safeRoute}-${viewport.label}.png`,
          fullPage: true,
        });

        expect(errors, `console errors on ${route}`).toEqual([]);
      });
    }
  }
});

test.describe('sprint-05 persona smoke — dashboard landing', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (BLOCKED_HOSTS.some((host) => url.includes(host))) return route.abort();
      return route.continue();
    });
  });

  for (const viewport of viewports) {
    test(`dashboard / unauth landing @ ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await page.goto(`${dashboardBase}/`, {
        waitUntil: 'domcontentloaded',
      });
      // Unauth Clerk typically redirects to /sign-in — 200 OK on landing page
      expect(response?.status(), `dashboard landing status`).toBeLessThan(500);

      await page.screenshot({
        path: `screenshots/sprint-05/dashboard-landing-${viewport.label}.png`,
        fullPage: true,
      });
    });
  }
});
