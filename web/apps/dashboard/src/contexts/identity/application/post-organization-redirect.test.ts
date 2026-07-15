import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/billing/application/oss-runtime', () => ({
  isOssRuntime: vi.fn(),
}));

import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';
import { resolvePostOrganizationRedirect } from './post-organization-redirect';

const mockIsOssRuntime = vi.mocked(isOssRuntime);

describe('resolvePostOrganizationRedirect', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('routes OSS users to /dashboard (AC-081)', () => {
    mockIsOssRuntime.mockReturnValue(true);
    expect(resolvePostOrganizationRedirect(true)).toBe('/dashboard');
    expect(resolvePostOrganizationRedirect(false)).toBe('/dashboard');
  });

  it('routes commercial users to choose-plan', () => {
    mockIsOssRuntime.mockReturnValue(false);
    expect(resolvePostOrganizationRedirect(true)).toBe('/onboarding/choose-plan');
    expect(resolvePostOrganizationRedirect(false)).toBe('/onboarding/choose-plan');
  });
});
