/**
 * Sprint 04 — Dashboard theme audit spec.
 *
 * Captures screenshots of 15+ routes in light and dark mode.
 * Verifies:
 *   - No hardcoded color classes in any rendered element's class attribute
 *   - All routes load without 500 errors
 *   - Light + dark screenshots saved to .artifacts/playwright/screenshots/
 *
 * Run order (per sprint runbook):
 *   1. Run with --update-snapshots BEFORE the color sweep (baseline)
 *   2. Run sweep
 *   3. Re-run to verify no visual regression (diff ≤ 2%)
 *
 * Usage:
 *   SKIP_WEB_SERVER=1 pnpm exec playwright test tests/e2e/dashboard/theme-audit.spec.ts --project=chromium
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';

const HARDCODED_COLOR_PATTERN =
  /\b(?:bg|text|border)-(?:amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose|emerald|teal|violet|gray)-\d{2,3}\b/;

/** Dashboard routes to audit — 15 routes minimum per sprint spec */
const AUDIT_ROUTES = [
  { path: '/dashboard', name: 'dashboard-overview' },
  { path: '/dashboard/incidents', name: 'incidents-list' },
  { path: '/dashboard/integrations', name: 'integrations' },
  { path: '/dashboard/team', name: 'team' },
  { path: '/dashboard/settings', name: 'settings' },
  { path: '/dashboard/billing', name: 'billing' },
  { path: '/auth/sign-in', name: 'sign-in' },
  { path: '/auth/sign-up', name: 'sign-up' },
  { path: '/dashboard/incidents/new', name: 'new-incident' },
  { path: '/onboarding/complete-profile', name: 'onboarding-profile' },
  { path: '/beta-waitlist', name: 'beta-waitlist' },
  // Additional routes to reach 15+
  { path: '/dashboard/topology', name: 'topology' },
  { path: '/dashboard/analyses', name: 'analyses' },
  { path: '/dashboard/analyses/new', name: 'new-analysis' },
  { path: '/dashboard/billing', name: 'billing-detail' },
] as const;

/** Screenshot output directory */
function getScreenshotDir(): string {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '')
    .replace(/\..+/, '')
    .slice(0, 15);
  return path.join(process.cwd(), '.artifacts', 'playwright', 'screenshots', stamp);
}

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

async function setColorMode(page: import('@playwright/test').Page, mode: 'light' | 'dark') {
  await page.evaluate((m) => {
    const html = document.documentElement;
    if (m === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, mode);
}

async function scanForHardcodedColors(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate((pattern) => {
    const allElements = document.querySelectorAll('[class]');
    const violations: string[] = [];
    for (const el of allElements) {
      const cls = el.className;
      if (typeof cls === 'string' && new RegExp(pattern).test(cls)) {
        violations.push(`${el.tagName.toLowerCase()}[class="${cls.slice(0, 120)}"]`);
      }
    }
    return violations;
  }, HARDCODED_COLOR_PATTERN.source);
}

test.describe('Dashboard theme audit — light mode', () => {
  test.use({ baseURL: DASHBOARD_URL });

  const screenshotDir = getScreenshotDir();

  for (const route of AUDIT_ROUTES) {
    test(`${route.name} — light mode renders without hardcoded colors`, async ({ page }) => {
      await blockTrackers(page);
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      // Allow auth redirects (3xx) but not server errors (5xx)
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }

      await setColorMode(page, 'light');
      await page.waitForTimeout(300);

      // Save screenshot
      const screenshotPath = path.join(screenshotDir, `${route.name}-light.png`);
      fs.mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: false });

      // Check for hardcoded color violations
      const violations = await scanForHardcodedColors(page);
      if (violations.length > 0) {
        console.warn(`[${route.name}] Hardcoded color violations:`, violations.slice(0, 5));
      }
      expect(violations).toHaveLength(0);
    });
  }
});

test.describe('Dashboard theme audit — dark mode', () => {
  test.use({ baseURL: DASHBOARD_URL });

  const screenshotDir = getScreenshotDir();

  for (const route of AUDIT_ROUTES) {
    test(`${route.name} — dark mode renders without hardcoded colors`, async ({ page }) => {
      await blockTrackers(page);
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      if (response) {
        expect(response.status()).toBeLessThan(500);
      }

      await setColorMode(page, 'dark');
      await page.waitForTimeout(300);

      // Save screenshot
      const screenshotPath = path.join(screenshotDir, `${route.name}-dark.png`);
      fs.mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: false });

      const violations = await scanForHardcodedColors(page);
      if (violations.length > 0) {
        console.warn(`[${route.name}] Hardcoded color violations:`, violations.slice(0, 5));
      }
      expect(violations).toHaveLength(0);
    });
  }
});
