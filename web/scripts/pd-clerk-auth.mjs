/**
 * Clerk sign-in token auth for PRoot — Sprint 06b product designer audit.
 *
 * Replicates setupClerkTestingToken manually:
 *  1. Fetch a CLERK_TESTING_TOKEN from the Clerk Backend API
 *  2. Register a Playwright route interceptor on the Clerk FAPI domain that
 *     appends __clerk_testing_token to every /v1/ request (bot-protection bypass)
 *  3. Navigate to the sign-in-token SSO callback
 *  4. Wait for Clerk JS to complete the sign-in and redirect
 *  5. Save storageState to tests/dashboard/.auth/user.json
 *
 * Usage:
 *   node scripts/pd-clerk-auth.mjs
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
const AUTH_FILE = path.join(ROOT, 'tests/dashboard/.auth/user.json');
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots/sprint-06b-dashboard/product-designer');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BLOCKED = ['google-analytics.com', 'googletagmanager.com', 'clarity.ms', 'intercom.io'];

async function shot(page, name) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
}

// Decode the Clerk FAPI domain from the publishable key
function clerkFapiFromPublishableKey(pk) {
  const middle = pk.replace(/^pk_(test|live)_/, '').replace(/\$.*/, '');
  const decoded = Buffer.from(middle, 'base64').toString('utf8').replace(/\$$/, '');
  return decoded; // e.g. comic-liger-28.clerk.accounts.dev
}

async function main() {
  const CLERK_FAPI = clerkFapiFromPublishableKey(CLERK_PUBLISHABLE_KEY);
  console.log(`[clerk] FAPI domain: ${CLERK_FAPI}`);

  // 1. Fetch CLERK_TESTING_TOKEN from Clerk Backend API
  console.log('[clerk] Fetching testing token...');
  const testingTokenRes = await fetch(`https://api.clerk.com/v1/testing_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!testingTokenRes.ok) {
    throw new Error(
      `Testing token fetch failed: ${testingTokenRes.status} ${await testingTokenRes.text()}`,
    );
  }
  const { token: CLERK_TESTING_TOKEN } = await testingTokenRes.json();
  console.log(`[clerk] Testing token: ${CLERK_TESTING_TOKEN.slice(0, 20)}...`);

  // 2. Look up user and mint sign-in token
  console.log('[clerk] Looking up user...');
  const usersRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(EMAIL)}`,
    { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } },
  );
  if (!usersRes.ok) throw new Error(`User lookup: ${usersRes.status}`);
  const users = await usersRes.json();
  if (!users.length) throw new Error(`No user found for ${EMAIL}`);
  const userId = users[0].id;

  const signInTokenRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!signInTokenRes.ok)
    throw new Error(`Sign-in token mint: ${signInTokenRes.status} ${await signInTokenRes.text()}`);
  const { token: signInToken } = await signInTokenRes.json();
  console.log(`[clerk] Sign-in token: ${signInToken.slice(0, 20)}...`);

  // 3. Launch browser
  const localChromium = '/usr/bin/chromium';
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (fs.existsSync(localChromium)) launchOpts.executablePath = localChromium;
  const browser = await chromium.launch(launchOpts);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // 4. Block analytics
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  // 5. Register Clerk FAPI interceptor — appends __clerk_testing_token to bypass bot protection
  //    and patches captcha_bypass in responses (exact replica of @clerk/testing)
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
      } catch {
        body = undefined;
      }
      await route.fulfill({ response, body });
    } catch {
      await route.continue();
    }
  });

  const page = await ctx.newPage();

  // 6. Navigate to SSO callback
  const signInUrl = `${DASHBOARD_URL}/auth/sign-in#/sso-callback?__clerk_ticket=${signInToken}`;
  console.log('[clerk] Navigating to SSO callback...');
  await page.goto(signInUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for Clerk JS to mount and process the ticket (up to 60s)
  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60000 });
    console.log(`[clerk] Redirected to: ${page.url()}`);
  } catch {
    await shot(page, 'auth-stuck');
    console.log(`[clerk] Did not redirect. URL: ${page.url()}`);
  }

  const finalUrl = page.url();
  const isAuthed = !finalUrl.includes('/auth/') && !finalUrl.includes('/sign-in');
  console.log(`[clerk] Auth: ${isAuthed ? 'SUCCESS' : 'FAILED'} — ${finalUrl}`);

  if (!isAuthed) {
    await browser.close();
    process.exit(1);
  }

  // 7. Skip onboarding modal
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

  await ctx.storageState({ path: AUTH_FILE });
  console.log(`[clerk] Session saved to ${AUTH_FILE}`);

  await browser.close();
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
