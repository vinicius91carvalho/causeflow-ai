/**
 * Product Designer Audit — Sprint 06b (REWRITE 2026-04-19)
 * Fixes: session-health check + per-route content sentinels + long PRoot waits.
 *
 * Run via playwright.config.ts project `dashboard-review` which wires
 * `dashboard-setup` as dependency and `storageState` to tests/dashboard/.auth/user.json.
 *
 * CLERK_SECRET_KEY=... DASHBOARD_TEST_EMAIL=vinicius@simuser.ai \
 *   SKIP_WEB_SERVER=1 DASHBOARD_URL=http://localhost:3001 \
 *   pnpm exec playwright test --project=dashboard-review \
 *   tests/e2e/review/product-designer-audit.spec.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const SCREENSHOT_DIR = path.join(
  __dirname,
  '../../../screenshots/sprint-06b-dashboard/product-designer',
);

const BASE = process.env.DASHBOARD_URL || 'http://localhost:3001';

const BLOCKED = [
  'google-analytics.com',
  'googletagmanager.com',
  'clarity.ms',
  'intercom.io',
  'c.bing.com',
];

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

/**
 * Navigate to a dashboard route and wait for genuine content to render.
 * Fails loud if session lost (redirect to /auth/sign-in).
 * Accepts first-hit PRoot compile latency up to 120s.
 */
async function gotoAndWait(
  page: Page,
  url: string,
  opts: { sentinel: string; settleMs?: number; networkIdleMs?: number } = { sentinel: 'main' },
) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });

  // Session health: abort if Clerk bounced us to sign-in.
  const currentUrl = new URL(page.url());
  if (currentUrl.pathname.startsWith('/auth/')) {
    throw new Error(
      `SESSION_LOST: ${url} redirected to ${currentUrl.pathname}. Check pd-auth-setup and Clerk token.`,
    );
  }

  // Wait for genuine page content to appear (sentinel proves page rendered, not just shell).
  await page.waitForSelector(opts.sentinel, { state: 'visible', timeout: 120000 });

  // Allow client-side fetches (metrics, integrations, SSE) to settle.
  await page
    .waitForLoadState('networkidle', { timeout: opts.networkIdleMs ?? 20000 })
    .catch(() => {});

  // Paint settle.
  await page.waitForTimeout(opts.settleMs ?? 2000);
}

test.describe('Product Designer Audit — Sprint 06b', () => {
  test.use({ baseURL: BASE, viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ context, page }) => {
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (BLOCKED.some((h) => url.includes(h))) return route.abort();
      return route.continue();
    });

    // Pre-test session probe: hit /dashboard, verify not redirected.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const probeUrl = new URL(page.url());
    if (probeUrl.pathname.startsWith('/auth/')) {
      throw new Error(`SESSION_LOST at /dashboard probe — redirected to ${probeUrl.pathname}`);
    }
    // Warm: let the shell/sidebar hydrate before the real test.
    await page.waitForSelector('main', { state: 'visible', timeout: 120000 });
  });

  // ── 1. Dashboard overview / home ─────────────────────────────────────────
  test('01 — dashboard overview', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard`, {
      sentinel: '[data-testid="dashboard-overview"]',
      settleMs: 4000,
    });
    // Wait for either branch empty-state CTA or metrics card resolved.
    await expect(
      page
        .locator(
          '[data-testid="cta-new-analysis"], [data-testid="metric-total-analyses"], [data-testid="branch-a-empty"], [data-testid="branch-b-empty"]',
        )
        .first(),
    ).toBeVisible({ timeout: 30000 });
    await shot(page, '01-dashboard-overview');
  });

  // ── 2. Incidents list ─────────────────────────────────────────────────────
  test('02 — incidents list', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/incidents`, { sentinel: 'main h1, main h2' });
    await shot(page, '02-incidents-list');
  });

  // ── 3. New incident form ──────────────────────────────────────────────────
  test('03 — new incident form', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/incidents/new`, {
      sentinel: 'input[name="title"], input[id="incident-title"]',
    });
    await shot(page, '03-new-incident-form-empty');

    const titleField = page.locator('input[name="title"], input[id="incident-title"]').first();
    await titleField.fill('Checkout service 503 errors spiking — payment flow impacted');

    const criticalBtn = page
      .locator('button, label')
      .filter({ hasText: /critical/i })
      .first();
    if (await criticalBtn.isVisible().catch(() => false)) await criticalBtn.click();

    await shot(page, '03b-new-incident-form-filled');
  });

  // ── 4. Integrations page ─────────────────────────────────────────────────
  test('04 — integrations page', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/integrations`, { sentinel: 'main h1, main h2' });
    await shot(page, '04-integrations-page');
  });

  // ── 5. Team page ─────────────────────────────────────────────────────────
  test('05 — team page', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/team`, { sentinel: 'main' });
    await shot(page, '05-team-page');
  });

  // ── 6. Billing page ──────────────────────────────────────────────────────
  test('06 — billing page', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/billing`, { sentinel: 'main h1, main h2' });
    await shot(page, '06-billing-page');
  });

  // ── 7. Settings page ─────────────────────────────────────────────────────
  test('07 — settings page', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/settings`, { sentinel: 'main h1, main h2' });
    await shot(page, '07-settings-page');
  });

  // ── 8. Audit trail page ───────────────────────────────────────────────────
  test('08 — audit trail page', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/audit`, { sentinel: 'main h1, main h2' });
    await shot(page, '08-audit-trail-page');
  });

  // ── 9. Intelligence page ─────────────────────────────────────────────────
  test('09 — intelligence page', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/intelligence`, { sentinel: 'main h1, main h2' });
    await shot(page, '09-intelligence-page');
  });

  // ── 10. Relay page ───────────────────────────────────────────────────────
  test('10 — relay page', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/relay`, { sentinel: 'main h1, main h2' });
    await shot(page, '10-relay-page');
  });

  // ── 11. Analyses page (expected redirect to /incidents) ──────────────────
  test('11 — analyses page', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/analyses`, { sentinel: 'main h1, main h2' });
    await shot(page, '11-analyses-page');
  });

  // ── 12. Sign-in page (unauthenticated, new context) ──────────────────────
  test('12 — sign-in page', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const p = await ctx.newPage();
    await ctx.route('**/*', (route) => {
      const url = route.request().url();
      if (BLOCKED.some((h) => url.includes(h))) return route.abort();
      return route.continue();
    });
    await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p.waitForSelector('input[name="identifier"], input[type="email"]', { timeout: 60000 });
    await p.waitForTimeout(2000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await p.screenshot({ path: path.join(SCREENSHOT_DIR, '12-sign-in-page.png'), fullPage: true });
    await ctx.close();
  });

  // ── 13. Onboarding welcome ───────────────────────────────────────────────
  test('13 — onboarding welcome', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/onboarding/welcome`, { sentinel: 'main' });
    await shot(page, '13-onboarding-welcome');
  });

  // ── 14. Onboarding choose-plan ───────────────────────────────────────────
  test('14 — onboarding choose-plan', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/onboarding/choose-plan`, { sentinel: 'main' });
    await shot(page, '14-onboarding-choose-plan');
  });

  // ── 15. Create investigation full flow ───────────────────────────────────
  test('15 — create investigation full flow', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/incidents/new`, {
      sentinel: 'input[name="title"], input[id="incident-title"]',
    });
    await shot(page, '15a-investigation-create-step1-form');

    const titleField = page.locator('input[name="title"], input[id="incident-title"]').first();
    await titleField.fill('Checkout service 503 errors spiking — payment flow impacted');

    const descField = page
      .locator('textarea[name="description"], textarea[id="incident-description"]')
      .first();
    if (await descField.isVisible().catch(() => false)) {
      await descField.fill(
        'Starting at 14:32 UTC, the checkout service began returning 503 errors at ~15% rate. Payment processing flow affected. Correlates with a recent deployment of the payment-gateway service v2.4.1 at 14:28 UTC.',
      );
    }

    const severityOptions = page.locator('button').filter({ hasText: /critical/i });
    if (
      await severityOptions
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await severityOptions.first().click();
    }

    await shot(page, '15b-investigation-create-step2-filled');

    const submitBtn = page
      .locator('button[type="submit"]')
      .filter({ hasText: /create|submit|start|investigate/i })
      .first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(8000);
      await shot(page, '15c-investigation-create-step3-post-submit');

      const currentUrl = page.url();
      if (currentUrl.includes('/incidents/')) {
        await page.waitForSelector('main', { state: 'visible', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(4000);
        await shot(page, '15d-investigation-detail-processing');

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await page.waitForTimeout(1500);
        await shot(page, '15e-investigation-detail-scroll-mid');

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
        await shot(page, '15f-investigation-detail-scroll-bottom');
      }
    } else {
      await shot(page, '15c-no-submit-button-found');
    }
  });

  // ── 16. Existing incident detail ─────────────────────────────────────────
  test('16 — existing incident detail', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard/incidents`, { sentinel: 'main' });
    const firstIncident = page
      .locator('a[href*="/incidents/"], tr[data-href*="/incidents/"]')
      .first();
    if (await firstIncident.isVisible({ timeout: 10000 }).catch(() => false)) {
      await firstIncident.click();
      await page.waitForSelector('main', { state: 'visible', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(6000);
      await shot(page, '16a-incident-detail-view');

      await page.evaluate(() => window.scrollTo(0, 300));
      await page.waitForTimeout(1500);
      await shot(page, '16b-incident-detail-mid');
    } else {
      await shot(page, '16-incidents-empty-state');
    }
  });

  // ── 17. Mobile sidebar ────────────────────────────────────────────────────
  test('17 — mobile sidebar nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWait(page, `${BASE}/dashboard`, {
      sentinel: '[data-testid="dashboard-overview"]',
      settleMs: 3000,
    });
    await shot(page, '17a-mobile-dashboard-closed-nav');

    const menuBtn = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]').first();
    if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, '17b-mobile-dashboard-open-nav');
    }
  });

  // ── 18. Collapsed sidebar ────────────────────────────────────────────────
  test('18 — collapsed sidebar state', async ({ page }) => {
    await gotoAndWait(page, `${BASE}/dashboard`, {
      sentinel: '[data-testid="dashboard-overview"]',
      settleMs: 3000,
    });

    const collapseBtn = page
      .locator('button[aria-label*="collapse"], button[aria-label*="Collapse"]')
      .first();
    if (await collapseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await collapseBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, '18-collapsed-sidebar');
    } else {
      await shot(page, '18-no-collapse-btn-found');
    }
  });
});
