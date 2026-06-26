/**
 * Product Designer Dashboard Audit — Sprint 06b
 *
 * Combined auth + audit in a single browser context so Clerk session stays live.
 * Uses the same FAPI intercept technique as @clerk/testing (setupClerkTestingToken).
 *
 * Usage:
 *   node scripts/pd-full-audit.mjs
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const DASHBOARD_URL = 'http://localhost:3001';
const EMAIL = 'vinicius@simuser.ai';
const CLERK_SECRET_KEY = 'sk_test_zrOdKQaUtuFZarEWlgKMBJlKAFBEjrxzCpoSebBr2v';
const CLERK_PUBLISHABLE_KEY = 'pk_test_Y29taWMtbGlnZXItMjguY2xlcmsuYWNjb3VudHMuZGV2JA';
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots/sprint-06b-dashboard/product-designer');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BLOCKED = ['google-analytics.com', 'googletagmanager.com', 'clarity.ms', 'intercom.io'];

function clerkFapiFromPublishableKey(pk) {
  const middle = pk.replace(/^pk_(test|live)_/, '').replace(/\$.*/, '');
  return Buffer.from(middle, 'base64').toString('utf8').replace(/\$$/, '');
}

async function shot(page, name) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
}

async function navigate(page, url, name, waitMs = 5000) {
  console.log(`\n[audit] ${url}`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(waitMs);
    await shot(page, name);
    const finalUrl = page.url();
    if (finalUrl.includes('/auth/') || finalUrl.includes('/sign-in')) {
      console.log(`  [WARNING] Redirected to auth: ${finalUrl}`);
    }
  } catch (e) {
    console.log(`  [error] ${String(e).slice(0, 100)}`);
    try {
      await shot(page, `${name}-error`);
    } catch {}
  }
}

async function main() {
  const CLERK_FAPI = clerkFapiFromPublishableKey(CLERK_PUBLISHABLE_KEY);
  console.log(`[clerk] FAPI: ${CLERK_FAPI}`);

  // 1. Fetch testing token
  const ttRes = await fetch('https://api.clerk.com/v1/testing_tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!ttRes.ok) throw new Error(`Testing token: ${ttRes.status}`);
  const { token: CLERK_TESTING_TOKEN } = await ttRes.json();
  console.log(`[clerk] Testing token: ${CLERK_TESTING_TOKEN.slice(0, 20)}...`);

  // 2. Look up user + mint sign-in token
  const usersRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(EMAIL)}`,
    { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } },
  );
  const users = await usersRes.json();
  if (!users.length) throw new Error(`No user: ${EMAIL}`);

  const sitRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: users[0].id }),
  });
  if (!sitRes.ok) throw new Error(`Sign-in token: ${sitRes.status}`);
  const { token: signInToken } = await sitRes.json();
  console.log(`[clerk] Sign-in token minted`);

  // 3. Launch browser
  const localChromium = '/usr/bin/chromium';
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (fs.existsSync(localChromium)) launchOpts.executablePath = localChromium;
  const browser = await chromium.launch(launchOpts);

  // 4. Single context — register FAPI interceptor before any navigation
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // Block trackers
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  // Clerk FAPI interceptor (bot-protection bypass, same as @clerk/testing)
  const fapiEscaped = CLERK_FAPI.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fapiRegex = new RegExp(`^https://${fapiEscaped}/v1/.*?(\\?.*)?$`);
  await ctx.route(fapiRegex, async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('__clerk_testing_token', CLERK_TESTING_TOKEN);
    try {
      const response = await route.fetch({ url: url.toString() });
      let body;
      try {
        const json = await response.json();
        if (json?.response?.captcha_bypass === false) json.response.captcha_bypass = true;
        if (json?.client?.captcha_bypass === false) json.client.captcha_bypass = true;
        body = JSON.stringify(json);
      } catch {}
      await route.fulfill({ response, body });
    } catch {
      await route.continue();
    }
  });

  const page = await ctx.newPage();

  // 5. Authenticate — SSO callback within same context
  console.log('\n[auth] Navigating to SSO callback...');
  const signInUrl = `${DASHBOARD_URL}/auth/sign-in#/sso-callback?__clerk_ticket=${signInToken}`;
  await page.goto(signInUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60000 });
    console.log(`[auth] SUCCESS — ${page.url()}`);
  } catch {
    await shot(page, 'auth-failed');
    console.log(`[auth] FAILED — ${page.url()}`);
    // Continue anyway to capture what we can
  }

  // Skip onboarding modal
  await page.evaluate(() => {
    try {
      const steps = {};
      for (const k of [
        'welcome',
        'integrations',
        'relay',
        'firstIncident',
        'receiveEvents',
        'billing',
        'complete',
      ])
        steps[k] = 'skipped';
      localStorage.setItem(
        'causeflow-onboarding-progress',
        JSON.stringify({
          startedAt: new Date().toISOString(),
          completedAt: null,
          completed: false,
          skipped: true,
          currentStep: 'complete',
          steps,
        }),
      );
    } catch {}
  });

  // ── AUDIT ─────────────────────────────────────────────────────────────────

  // Core routes
  await navigate(page, `${DASHBOARD_URL}/dashboard`, '01-dashboard-overview');
  await navigate(page, `${DASHBOARD_URL}/dashboard/incidents`, '02-incidents-list');
  await navigate(page, `${DASHBOARD_URL}/dashboard/incidents/new`, '03-new-incident-form-empty');
  await navigate(page, `${DASHBOARD_URL}/dashboard/integrations`, '04-integrations-page');
  await navigate(page, `${DASHBOARD_URL}/dashboard/team`, '05-team-page');
  await navigate(page, `${DASHBOARD_URL}/dashboard/billing`, '06-billing-page');
  await navigate(page, `${DASHBOARD_URL}/dashboard/settings`, '07-settings-page');
  await navigate(page, `${DASHBOARD_URL}/dashboard/audit`, '08-audit-trail-page');
  await navigate(page, `${DASHBOARD_URL}/dashboard/intelligence`, '09-intelligence-page');
  await navigate(page, `${DASHBOARD_URL}/dashboard/relay`, '10-relay-page');

  // Investigation creation flow
  console.log('\n[audit] INVESTIGATION CREATION FLOW');
  await page.goto(`${DASHBOARD_URL}/dashboard/incidents/new`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(5000);
  await shot(page, '15a-invest-form-initial');

  const titleInput = page.locator('#incident-title, input[name="title"]').first();
  if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await titleInput.fill('Checkout service 503 errors — payment flow impacted');

    const descInput = page.locator('textarea').first();
    if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descInput.fill(
        'Starting at 14:32 UTC, checkout service returning 503 errors at ~15% rate. Correlates with payment-gateway v2.4.1 deploy at 14:28 UTC.',
      );
    }
    await shot(page, '15b-invest-form-filled');

    // Select severity
    const criticalBtns = page.locator('button').filter({ hasText: /^critical$/i });
    if (
      await criticalBtns
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await criticalBtns.first().click();
      await page.waitForTimeout(400);
    }
    await shot(page, '15c-invest-form-severity');

    // Submit
    const submitBtn = page.locator('button[type="submit"]').last();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
      console.log('  [submit] Submitted');
      await page.waitForTimeout(8000);
      await shot(page, '15d-invest-post-submit');

      const afterUrl = page.url();
      console.log(`  [url] ${afterUrl}`);

      if (afterUrl.includes('/incidents/') && !afterUrl.endsWith('/new')) {
        await page.waitForTimeout(5000);
        await shot(page, '15e-invest-detail-live');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await page.waitForTimeout(2000);
        await shot(page, '15f-invest-detail-mid');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        await shot(page, '15g-invest-detail-bottom');
      }
    }
  } else {
    console.log('  [note] Form not found (auth redirect?)');
    await shot(page, '15-invest-no-form');
  }

  // Existing incidents
  console.log('\n[audit] Checking for existing incidents...');
  await page.goto(`${DASHBOARD_URL}/dashboard/incidents`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(5000);

  const incidentLink = page.locator('a[href*="/incidents/"]').first();
  if (await incidentLink.isVisible({ timeout: 3000 }).catch(() => false)) {
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
    await shot(page, '16-incidents-list-state');
  }

  // Mobile sidebar
  console.log('\n[audit] Mobile nav...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await shot(page, '17a-mobile-closed');
  const hamburger = page
    .locator('button')
    .filter({ hasText: '' })
    .and(page.locator('[aria-label*="menu" i], [aria-label*="navigation" i]'))
    .first();
  if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
    await hamburger.click();
    await page.waitForTimeout(1000);
    await shot(page, '17b-mobile-open');
  }

  // Collapsed sidebar (desktop)
  console.log('\n[audit] Collapsed sidebar...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  const collapseBtn = page.locator('button[aria-label*="collapse" i]').first();
  if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await collapseBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, '18-sidebar-collapsed');
  } else {
    await shot(page, '18-sidebar-default');
  }

  // Onboarding pages
  console.log('\n[audit] Onboarding...');
  for (const [name, route] of [
    ['19-onboarding-welcome', '/onboarding/welcome'],
    ['20-onboarding-business-profile', '/onboarding/business-profile'],
    ['21-onboarding-choose-plan', '/onboarding/choose-plan'],
    ['22-onboarding-integrations', '/onboarding/integrations'],
  ]) {
    await navigate(page, `${DASHBOARD_URL}${route}`, name, 4000);
  }

  await ctx.close();
  await browser.close();

  const files = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith('.png'));
  console.log(`\n[done] ${files.length} screenshots in ${SCREENSHOT_DIR}`);
}

main().catch((e) => {
  console.error('[fatal]', e.message || e);
  process.exit(1);
});
