/**
 * Product Designer Auth Setup — Sprint 06b
 * Performs a real password-based Clerk sign-in and saves session state.
 * Avoids the clerk-testing token approach which fails in PRoot/dev mode.
 *
 * Run first:
 *   SKIP_WEB_SERVER=1 DASHBOARD_URL=http://localhost:3001 \
 *   pnpm exec playwright test tests/e2e/review/pd-auth-setup.ts --timeout=120000
 */

import * as path from 'node:path';
import { test as setup } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';
const EMAIL = process.env.DASHBOARD_TEST_EMAIL || 'vinicius@simuser.ai';
const PASSWORD = process.env.DASHBOARD_TEST_PASSWORD || 'uDF8VYceGPKycs7';
const AUTH_FILE = path.join(__dirname, '../../../tests/dashboard/.auth/user.json');

const BLOCKED = [
  'google-analytics.com',
  'googletagmanager.com',
  'clarity.ms',
  'intercom.io',
  'c.bing.com',
];

setup.describe.configure({ mode: 'serial' });

setup('authenticate via password', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  // Navigate to sign-in
  await page.goto(`${DASHBOARD_URL}/auth/sign-in`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  // Wait for Clerk component to load
  await page.waitForSelector('input[name="identifier"], input[type="email"]', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Fill email
  const emailInput = page.locator('input[name="identifier"], input[type="email"]').first();
  await emailInput.fill(EMAIL);
  await page.waitForTimeout(500);

  // Click Continue/Next
  const continueBtn = page
    .locator('button[type="submit"], button')
    .filter({ hasText: /continue|next|sign in/i })
    .first();
  if (await continueBtn.isVisible({ timeout: 3000 })) {
    await continueBtn.click();
    await page.waitForTimeout(2000);
  }

  // Fill password if prompted
  const passwordInput = page.locator('input[type="password"]').first();
  if (await passwordInput.isVisible({ timeout: 10000 })) {
    await passwordInput.fill(PASSWORD);
    await page.waitForTimeout(500);

    const signInBtn = page
      .locator('button[type="submit"], button')
      .filter({ hasText: /sign in|continue|log in/i })
      .first();
    await signInBtn.click();
  }

  // Wait for redirect away from auth
  await page.waitForURL((url) => !url.pathname.includes('/auth/'), { timeout: 60000 });

  // Skip onboarding modal
  await page.evaluate(() => {
    try {
      const now = new Date().toISOString();
      const steps: Record<string, string> = {};
      for (const k of [
        'welcome',
        'integrations',
        'relay',
        'firstIncident',
        'receiveEvents',
        'billing',
        'complete',
      ]) {
        steps[k] = 'skipped';
      }
      localStorage.setItem(
        'causeflow-onboarding-progress',
        JSON.stringify({
          startedAt: now,
          completedAt: null,
          completed: false,
          skipped: true,
          currentStep: 'complete',
          steps,
        }),
      );
    } catch {
      // ignore
    }
  });

  await page.context().storageState({ path: AUTH_FILE });
  console.log(`[pd-auth-setup] Session saved to ${AUTH_FILE}`);
});
