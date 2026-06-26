/**
 * Product Designer Dashboard Audit — Sprint 06b
 * Standalone Node script (not Playwright test runner).
 * Handles auth via password, then screenshots all key surfaces.
 *
 * Usage:
 *   node scripts/pd-audit.mjs
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots/sprint-06b-dashboard/product-designer');
const AUTH_FILE = path.join(ROOT, 'tests/dashboard/.auth/user.json');

const BLOCKED = [
  'google-analytics.com',
  'googletagmanager.com',
  'clarity.ms',
  'intercom.io',
  'c.bing.com',
];

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function shot(page, name) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
}

async function blockTrackers(context) {
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });
}

async function main() {
  const localChromium = '/usr/bin/chromium';
  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  };
  if (fs.existsSync(localChromium)) launchOpts.executablePath = localChromium;

  const browser = await chromium.launch(launchOpts);

  // ── Use pre-saved Clerk session (run scripts/pd-clerk-auth.mjs first) ────
  if (!fs.existsSync(AUTH_FILE)) {
    console.error(`[error] No auth session at ${AUTH_FILE}. Run scripts/pd-clerk-auth.mjs first.`);
    process.exit(1);
  }
  console.log(`[audit] Using saved session from ${AUTH_FILE}`);

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    storageState: AUTH_FILE,
  });
  await blockTrackers(ctx);
  const page = await ctx.newPage();

  const routes = [
    ['01-dashboard-overview', '/dashboard'],
    ['02-incidents-list', '/dashboard/incidents'],
    ['03-new-incident-form', '/dashboard/incidents/new'],
    ['04-integrations-page', '/dashboard/integrations'],
    ['05-team-page', '/dashboard/team'],
    ['06-billing-page', '/dashboard/billing'],
    ['07-settings-page', '/dashboard/settings'],
    ['08-audit-trail-page', '/dashboard/audit'],
    ['09-intelligence-page', '/dashboard/intelligence'],
    ['10-relay-page', '/dashboard/relay'],
    ['11-analyses-redirect', '/dashboard/analyses'],
  ];

  for (const [name, route] of routes) {
    console.log(`\n[audit] ${route}`);
    try {
      await page.goto(`${DASHBOARD_URL}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await page.waitForTimeout(5000);
      await shot(page, name);

      // Note final URL (redirects are IA findings)
      const finalUrl = page.url();
      if (!finalUrl.includes(route.split('/').pop())) {
        console.log(`  [redirect] ${route} → ${finalUrl}`);
      }
    } catch (e) {
      console.log(`  [error] ${e.message.slice(0, 80)}`);
      await shot(page, `${name}-error`);
    }
  }

  // ── Investigation creation flow ──────────────────────────────────────────
  console.log('\n[audit] INVESTIGATION CREATION FLOW');
  await page.goto(`${DASHBOARD_URL}/dashboard/incidents/new`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(5000);
  await shot(page, '15a-invest-form-initial');

  const titleInput = page.locator('input[id="incident-title"], input[name="title"]').first();
  const hasForm = await titleInput.isVisible({ timeout: 5000 }).catch(() => false);
  if (hasForm) {
    await titleInput.fill('Checkout service 503 errors — payment flow impacted');

    const descInput = page.locator('textarea').first();
    if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descInput.fill(
        'Starting at 14:32 UTC, checkout service returning 503 errors at ~15% rate. Correlates with payment-gateway v2.4.1 deploy at 14:28 UTC.',
      );
    }
    await shot(page, '15b-invest-form-filled');

    // Select severity
    const severityBtns = page.locator('button').filter({ hasText: /^critical$/i });
    if (
      await severityBtns
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await severityBtns.first().click();
      await page.waitForTimeout(400);
    }
    await shot(page, '15c-invest-form-severity-selected');

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
      console.log('  [submit] Form submitted');
      await page.waitForTimeout(8000);
      await shot(page, '15d-invest-post-submit');

      const afterUrl = page.url();
      console.log(`  [url after submit] ${afterUrl}`);

      if (afterUrl.includes('/incidents/')) {
        // Capture processing state
        await page.waitForTimeout(5000);
        await shot(page, '15e-invest-detail-processing');

        // Scroll mid
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await page.waitForTimeout(2000);
        await shot(page, '15f-invest-detail-mid');

        // Scroll bottom
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        await shot(page, '15g-invest-detail-bottom');
      }
    }
  } else {
    console.log('  [note] Form not visible — redirected (auth?)');
    await shot(page, '15-invest-form-redirect');
  }

  // ── Existing incident detail ─────────────────────────────────────────────
  console.log('\n[audit] Looking for existing incident...');
  await page.goto(`${DASHBOARD_URL}/dashboard/incidents`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(5000);

  const incidentLink = page.locator('a[href*="/incidents/"]').first();
  const hasIncident = await incidentLink.isVisible({ timeout: 5000 }).catch(() => false);
  if (hasIncident) {
    const href = await incidentLink.getAttribute('href');
    console.log(`  [found] ${href}`);
    await incidentLink.click();
    await page.waitForTimeout(8000);
    await shot(page, '16a-incident-detail-top');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(2000);
    await shot(page, '16b-incident-detail-mid');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await shot(page, '16c-incident-detail-bottom');
  } else {
    console.log('  [empty state] No incidents found');
    await shot(page, '16-incidents-empty-state');
  }

  // ── Mobile sidebar ───────────────────────────────────────────────────────
  console.log('\n[audit] Mobile nav (390px)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${DASHBOARD_URL}/dashboard`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(4000);
  await shot(page, '17a-mobile-nav-closed');

  const hamburger = page
    .locator(
      'button[aria-label*="menu" i], button[aria-label*="Menu" i], button[aria-label*="navigation" i]',
    )
    .first();
  if (await hamburger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await hamburger.click();
    await page.waitForTimeout(1000);
    await shot(page, '17b-mobile-nav-open');
  }

  // ── Collapsed sidebar ────────────────────────────────────────────────────
  console.log('\n[audit] Collapsed sidebar (desktop)...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${DASHBOARD_URL}/dashboard`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(4000);

  const collapseBtn = page
    .locator('button[aria-label*="collapse" i], button[aria-label*="Collapse" i]')
    .first();
  if (await collapseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await collapseBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, '18-sidebar-collapsed');
  }

  // ── Onboarding ───────────────────────────────────────────────────────────
  console.log('\n[audit] Onboarding pages...');
  for (const [name, route] of [
    ['19-onboarding-welcome', '/onboarding/welcome'],
    ['20-onboarding-business-profile', '/onboarding/business-profile'],
    ['21-onboarding-choose-plan', '/onboarding/choose-plan'],
    ['22-onboarding-integrations', '/onboarding/integrations'],
  ]) {
    try {
      await page.goto(`${DASHBOARD_URL}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(4000);
      await shot(page, name);
      console.log(`  [ok] ${route} → ${page.url()}`);
    } catch (e) {
      console.log(`  [error] ${route}: ${e.message.slice(0, 60)}`);
    }
  }

  await ctx.close();
  await browser.close();

  console.log('\n[done] Screenshots saved to:', SCREENSHOT_DIR);
  console.log('[done] Files:', fs.readdirSync(SCREENSHOT_DIR).join(', '));
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
