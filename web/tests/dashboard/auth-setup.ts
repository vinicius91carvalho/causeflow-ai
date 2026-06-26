/**
 * Playwright global setup — Dashboard authentication via Clerk.
 *
 * Uses the Clerk Backend API to:
 *   1. Look up the test user by email
 *   2. Mint a sign-in token (Clerk's "magic link" equivalent)
 *   3. Inject the dev-browser testing token via @clerk/testing
 *   4. Visit /auth/sign-in#/sso-callback?__clerk_ticket=<token>
 *   5. Wait for the post-sign-in redirect
 *   6. Save resulting cookies to tests/dashboard/.auth/user.json
 *
 * Why this approach:
 *   - Clerk's React SignIn component mounts client-side, so DOM-driven login
 *     is brittle and slow. Sign-in tokens are deterministic and fast.
 *   - Avoids depending on the user's actual password — the secret key is
 *     enough to mint a session.
 *
 * Required env:
 *   - CLERK_SECRET_KEY        — Clerk Backend API key (sk_test_… in dev)
 *   - DASHBOARD_TEST_EMAIL    — email of an existing Clerk user (default: teste-5@causeflow.ai)
 *
 * Optional env:
 *   - DASHBOARD_URL           — defaults to http://127.0.0.1:3001
 */

import path from 'node:path';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || '';
const TEST_EMAIL = process.env.DASHBOARD_TEST_EMAIL || 'teste-5@causeflow.ai';
const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup.describe.configure({ mode: 'serial' });

setup('authenticate via Clerk sign-in token', async ({ page }) => {
  if (!CLERK_SECRET_KEY) {
    throw new Error(
      'CLERK_SECRET_KEY is required for dashboard auth-setup. ' +
        'Export it before running Playwright (the value lives in apps/dashboard/.env.local).',
    );
  }

  await clerkSetup({ secretKey: CLERK_SECRET_KEY });

  // Block analytics trackers to keep the network log clean.
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());

  // 1. Look up the user
  const usersRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(TEST_EMAIL)}`,
    { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } },
  );
  if (!usersRes.ok) {
    throw new Error(`Clerk user lookup failed: ${usersRes.status} ${await usersRes.text()}`);
  }
  const users = (await usersRes.json()) as Array<{ id: string }>;
  if (!users.length) {
    throw new Error(
      `No Clerk user found for ${TEST_EMAIL}. Create one in the Clerk dashboard or set DASHBOARD_TEST_EMAIL to an existing user.`,
    );
  }

  // 2. Mint a sign-in token
  const tokenRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: users[0].id }),
  });
  if (!tokenRes.ok) {
    throw new Error(
      `Clerk sign-in token creation failed: ${tokenRes.status} ${await tokenRes.text()}`,
    );
  }
  const { token } = (await tokenRes.json()) as { token: string };

  // 3. Inject Clerk dev-browser testing token (lets middleware bypass dev-browser init loop)
  await setupClerkTestingToken({ page });

  // 4. Use the sign-in ticket
  const signInUrl = `${DASHBOARD_URL}/auth/sign-in#/sso-callback?__clerk_ticket=${token}`;
  await page.goto(signInUrl, { waitUntil: 'domcontentloaded' });

  // 5. Wait for post-sign-in redirect away from /auth/*
  await page.waitForURL((url) => !url.pathname.includes('/auth/'), { timeout: 30000 });

  // 6. Pre-skip the welcome onboarding modal so it doesn't intercept clicks
  //    in subsequent tests. The orchestrator (onboarding-orchestrator.tsx)
  //    auto-opens the modal when localStorage has no `causeflow-onboarding-progress`
  //    entry. Setting an entry with `skipped: true` keeps it closed.
  await page.evaluate(() => {
    try {
      const now = new Date().toISOString();
      const stepKeys = [
        'welcome',
        'integrations',
        'relay',
        'firstIncident',
        'receiveEvents',
        'billing',
        'complete',
      ];
      const steps: Record<string, string> = {};
      for (const k of stepKeys) steps[k] = 'skipped';
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
      // ignore — will fall back to runtime dismissal
    }
  });

  // 7. Save state (cookies + localStorage)
  await page.context().storageState({ path: AUTH_FILE });

  // biome-ignore lint/suspicious/noConsole: setup logs are intentional
  console.log(`[auth-setup] Clerk session saved to ${AUTH_FILE} (user: ${TEST_EMAIL})`);
});
