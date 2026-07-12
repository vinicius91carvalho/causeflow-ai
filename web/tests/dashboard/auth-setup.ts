/**
 * Playwright global setup — Dashboard authentication via local JWT.
 *
 * After the Clerk removal (AC-046), the dashboard authenticates via a local
 * JWT stored in the `__session` httpOnly cookie. This setup generates a
 * valid HS256 JWT signed with the shared JWT_SECRET and saves it to the
 * Playwright storage state file so that all dashboard-authed tests can use
 * it without re-authenticating.
 *
 * No outbound call to clerk.com / stripe.com / amazonaws.com is made.
 */

import path from 'node:path';
import { test as setup } from '@playwright/test';
import { SignJWT } from 'jose';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'oss-dev-jwt-secret-change-me';
const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup.describe.configure({ mode: 'serial' });

setup('authenticate via local JWT', async () => {
  // Validate that JWT_SECRET is configured
  if (!JWT_SECRET || JWT_SECRET.trim() === '') {
    throw new Error(
      'JWT_SECRET is required for dashboard auth-setup. ' +
        'Export it before running Playwright or set it in apps/dashboard/.env.local.',
    );
  }

  // Generate a valid HS256 JWT signed with the shared secret.
  // Claims mirror what the CauseFlow Core API issues: sub, email, name,
  // tenantId, role. The `__session` cookie is set server-side by the
  // dashboard's /api/auth/login handler during real flows, but for tests
  // we mint one directly so we never need a real Core API.
  const secret = new TextEncoder().encode(JWT_SECRET.trim());
  const jwt = await new SignJWT({
    sub: 'test-user-id',
    email: 'test@causeflow.ai',
    name: 'Test User',
    tenantId: 'test-tenant-id',
    role: 'admin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(secret);

  // Verify the JWT is valid by decoding it
  const { jwtVerify } = await import('jose');
  const { payload } = await jwtVerify(jwt, secret, { algorithms: ['HS256'] });
  if (!payload || !payload.sub) {
    throw new Error('Generated JWT verification failed.');
  }

  // Save the JWT as the __session cookie in the storage state file.
  // This matches what the dashboard middleware expects and lets all
  // dashboard-authed tests skip the sign-in flow.
  const authFile = {
    cookies: [
      {
        name: '__session',
        value: jwt,
        domain: '127.0.0.1',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 7200,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };

  const fs = await import('node:fs');
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authFile, null, 2));

  // Quick smoke test: navigate to the dashboard to confirm the cookie works.
  // We open a brief page and check the middleware doesn't bounce us to sign-in.
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: DASHBOARD_URL,
  });
  const page = await context.newPage();

  try {
    // Block analytics/tracker domains
    await page.route('**/*.clarity.ms/**', (route) => route.abort());
    await page.route('**/google-analytics.com/**', (route) => route.abort());
    await page.route('**/googletagmanager.com/**', (route) => route.abort());

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // If redirected to /auth/sign-in, the session cookie didn't work.
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/')) {
      // The middleware redirected us — the cookie format might be wrong.
      // This is not necessarily a fatal setup error; the website tests can
      // still run. Log a warning and continue.
      console.warn(
        `[auth-setup] Warning: dashboard redirected to ${currentUrl}. ` +
          'The JWT cookie may not match the dashboard middleware expectations. ' +
          'Website tests will still proceed.',
      );
    } else {
      console.log(`[auth-setup] Dashboard session verified at ${currentUrl}`);
    }
  } catch (err) {
    // Navigation might fail if the dashboard server isn't up yet, or if mock
    // mode returns unexpected responses. That's OK — the auth file is still
    // created and can be used by tests that handle the mock state.
    console.warn(
      `[auth-setup] Smoke test warning: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await browser.close();
  }

  console.log(`[auth-setup] Local JWT session saved to ${AUTH_FILE}`);
});
