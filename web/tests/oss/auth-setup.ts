/**
 * Playwright setup — OSS compose dashboard auth via Core local register/login.
 *
 * AC-054 / PD-OSS-DASHBOARD-E2E-AUTH:
 * - Targets the compose dashboard (host :3001) with Core on host :3099.
 * - Obtains `__session` only by POSTing to the dashboard BFF auth routes,
 *   which proxy Core `POST /v1/auth/register` + `POST /v1/auth/login`.
 * - Never loads Clerk, never reads `.env.staging` / STAGING_TEST_USER,
 *   never mints a local JWT with `jose` as the pass path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { OSS_CORE_API_URL } from './helpers';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup.describe.configure({ mode: 'serial' });

setup('authenticate via Core local register/login', async ({ page }) => {
  // Staging Clerk path is explicitly not the pass path — ignore if present.
  if (process.env.STAGING_TEST_USER || process.env.STAGING_TEST_PASSWORD) {
    console.warn(
      '[dashboard-oss-e2e] Ignoring STAGING_TEST_USER / STAGING_TEST_PASSWORD. ' +
        'Auth uses Core local register/login only.',
    );
  }

  // Fail closed if Core on the documented compose host port is down.
  const health = await fetch(`${OSS_CORE_API_URL}/health`).catch(() => null);
  if (!health?.ok) {
    throw new Error(
      `Core API not reachable at ${OSS_CORE_API_URL}/health. ` +
        'Bring up the OSS stack with `docker compose up -d` from the web monorepo root first.',
    );
  }

  const stamp = Date.now();
  const email = `oss-e2e-${stamp}@causeflow.local`;
  const password = `OssE2e-${stamp}-Pw!`;
  const name = 'OSS E2E Admin';
  const tenantName = `OSS E2E Tenant ${stamp}`;

  // Register through the dashboard BFF → Core (sets __session on success).
  const register = await page.request.post('/api/auth/register', {
    data: { name, email, password, tenantName },
  });

  if (!register.ok()) {
    const login = await page.request.post('/api/auth/login', {
      data: { email, password },
    });
    expect(
      login.ok(),
      `Core local auth failed. register=${register.status()} login=${login.status()} ` +
        `registerBody=${await register.text()} loginBody=${await login.text()}`,
    ).toBeTruthy();
  }

  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === '__session');
  expect(
    session?.value,
    'expected __session cookie from dashboard BFF after Core register/login',
  ).toBeTruthy();

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`[dashboard-oss-e2e] Core local session saved to ${AUTH_FILE} (user=${email})`);
});
