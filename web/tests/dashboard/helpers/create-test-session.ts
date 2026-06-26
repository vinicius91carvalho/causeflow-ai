/**
 * Creates a valid Auth.js v5 JWT session token for E2E tests.
 *
 * Uses the same `encode()` function as Auth.js to produce a real JWE token
 * that the dashboard middleware will accept. This avoids the need to sign in
 * through the UI for every test — just set the cookie before navigation.
 *
 * IMPORTANT: This only works locally where AUTH_SECRET matches the dev secret.
 * It has zero impact on staging/production (no production code is modified).
 */

import type { BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-for-testing-only-32-chars';
const COOKIE_NAME = 'authjs.session-token';

interface TestSessionOptions {
  userId?: string;
  email?: string;
  name?: string;
  profileComplete: boolean;
  tenantId?: string | null;
  role?: 'admin' | 'member';
}

/**
 * Create a valid Auth.js session JWT with the given claims.
 */
export async function createSessionToken(options: TestSessionOptions): Promise<string> {
  return encode({
    token: {
      sub: options.userId ?? 'test-user-id',
      email: options.email ?? 'test@example.com',
      name: options.name ?? 'Test User',
      profileComplete: options.profileComplete,
      tenantId: options.tenantId ?? null,
      role: options.role ?? 'member',
    },
    secret: AUTH_SECRET,
    salt: COOKIE_NAME,
  });
}

/**
 * Set a valid Auth.js session cookie on the browser context.
 * Call this BEFORE navigating to a protected page.
 */
export async function setTestSession(
  context: BrowserContext,
  options: TestSessionOptions,
): Promise<void> {
  const token = await createSessionToken(options);
  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
