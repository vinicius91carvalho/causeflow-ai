import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreApiError } from '@/lib/api/http-api-client';

const mockIsOssRuntime = vi.fn(() => false);

vi.mock('@/contexts/billing/application/oss-runtime', () => ({
  isOssRuntime: () => mockIsOssRuntime(),
}));

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { tenantId: 't1', role: 'member' }),
}));

const mockCreatePortal = vi.fn().mockResolvedValue({ url: 'https://stripe.test/portal' });

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    createPortalSession: mockCreatePortal,
  }),
}));

import { POST } from './portal-handler';

describe('billing portal handler', () => {
  beforeEach(() => {
    mockIsOssRuntime.mockReturnValue(false);
    mockCreatePortal.mockReset();
    mockCreatePortal.mockResolvedValue({ url: 'https://stripe.test/portal' });
  });

  it('exports POST', () => {
    expect(POST).toBeDefined();
  });

  it('returns 410 in OSS runtime without calling Core (AC-075)', async () => {
    mockIsOssRuntime.mockReturnValue(true);
    const req = new NextRequest('http://localhost:3001/api/billing/portal', {
      method: 'POST',
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(410);
    expect(mockCreatePortal).not.toHaveBeenCalled();
  });

  it('surfaces Core 410 as billing disabled message (AC-048)', async () => {
    mockCreatePortal.mockRejectedValueOnce(
      new CoreApiError('Billing is disabled in the OSS build. Portal is not available.', 410),
    );
    const req = new NextRequest('http://localhost:3001/api/billing/portal', {
      method: 'POST',
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/billing is disabled/i);
  });
});
