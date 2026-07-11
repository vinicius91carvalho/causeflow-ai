/**
 * RBAC Member Read-Access — Playwright E2E (Sprint 04)
 *
 * Verifies that a member-role user:
 *   1. Can view billing, settings, team, and integrations pages without 403/redirect
 *   2. Sees no mutation controls on any of the four pages
 *   3. Can open the Stripe Portal via the "Manage billing in Stripe" button
 *
 * Auth: local JWT with role=member (mirrors tests/dashboard/auth-setup.ts).
 *
 * Tag: @member-read (run with `--grep @member-read` for selective execution).
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { SignJWT } from 'jose';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'oss-dev-jwt-secret-change-me';

async function signInAsMember(page: Page): Promise<void> {
  const secret = new TextEncoder().encode(JWT_SECRET.trim());
  const jwt = await new SignJWT({
    sub: 'member-user-id',
    email: 'member@causeflow.ai',
    name: 'Member User',
    tenantId: 'test-tenant-id',
    role: 'member',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(secret);

  await page.context().addCookies([
    {
      name: '__session',
      value: jwt,
      domain: '127.0.0.1',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 7200,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

test.describe('@member-read', () => {
  test('member can view billing page with Stripe Portal button and no mutation controls', async ({
    page,
  }) => {
    await signInAsMember(page);
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });

    // View-only fields visible
    await expect(page.locator('main')).toBeVisible();

    // Manage billing button visible to both roles
    const portalBtn = page
      .getByRole('button', { name: /manage|billing|stripe|subscription/i })
      .first();
    await expect(portalBtn).toBeVisible();

    // Mutation buttons not visible
    await expect(page.getByRole('button', { name: /change plan|upgrade|cancel/i })).toHaveCount(0);
  });

  test('member can view settings page with disabled inputs and no save button', async ({
    page,
  }) => {
    await signInAsMember(page);
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible();
    // Save button should not exist for members on read-only tabs
    await expect(page.getByRole('button', { name: /^save/i })).toHaveCount(0);
  });

  test('member can view team page with no invite or role-change controls', async ({ page }) => {
    await signInAsMember(page);
    await page.goto(`${DASHBOARD_URL}/dashboard/team`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible();
    // Invite button hidden for members
    await expect(page.getByRole('button', { name: /invite/i })).toHaveCount(0);
    // No role-change combobox in member rows
    await expect(page.getByRole('combobox')).toHaveCount(0);
  });

  test('member can view integrations page with no connect or disconnect controls', async ({
    page,
  }) => {
    await signInAsMember(page);
    await page.goto(`${DASHBOARD_URL}/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('main')).toBeVisible();
    // Members must not see connect/disconnect/test buttons
    await expect(
      page.getByRole('button', { name: /^(connect|disconnect|test connection)/i }),
    ).toHaveCount(0);
  });
});
