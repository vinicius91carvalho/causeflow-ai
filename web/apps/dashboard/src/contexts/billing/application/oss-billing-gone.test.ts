import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { BILLING_DISABLED_MESSAGE } from './billing-disabled';

const dashboardPkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../../package.json', import.meta.url)), 'utf8'),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

const mockIsOssRuntime = vi.fn();

vi.mock('./oss-runtime', () => ({
  isOssRuntime: () => mockIsOssRuntime(),
}));

import { ossBillingGoneResponse } from './oss-billing-gone';

describe('ossBillingGoneResponse (AC-012 / AC-075)', () => {
  it('returns 404 when OSS runtime is active (not a 410 facade)', async () => {
    mockIsOssRuntime.mockReturnValue(true);
    const res = ossBillingGoneResponse();
    expect(res).not.toBeNull();
    expect(res?.status).toBe(404);
    const body = await res?.json();
    expect(body.error).toBe(BILLING_DISABLED_MESSAGE);
  });

  it('returns null when commercial runtime is active', () => {
    mockIsOssRuntime.mockReturnValue(false);
    expect(ossBillingGoneResponse()).toBeNull();
  });
});

describe('AC-075 dashboard package commercial purge', () => {
  it('has no Stripe SDK dependencies', () => {
    const deps = { ...dashboardPkg.dependencies, ...dashboardPkg.devDependencies };
    for (const name of Object.keys(deps)) {
      expect(name).not.toMatch(/stripe/i);
    }
  });

  it('does not ship add-credits CLI script', () => {
    expect(dashboardPkg.scripts?.['credits:add']).toBeUndefined();
  });
});
