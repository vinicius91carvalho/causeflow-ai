import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreApiError } from '@/lib/api/http-api-client';

const mockIsOssRuntime = vi.fn(() => false);

vi.mock('@/contexts/billing/application/oss-runtime', () => ({
  isOssRuntime: () => mockIsOssRuntime(),
}));

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { tenantId: 't1', role: 'admin', email: 'a@b.com', userId: 'u1' }),
}));

const mockCreateCheckout = vi
  .fn()
  .mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_test' });

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ createCheckout: mockCreateCheckout }),
}));

import { POST } from './checkout-handler';

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    mockIsOssRuntime.mockReturnValue(false);
    mockCreateCheckout.mockReset();
    mockCreateCheckout.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_test' });
  });

  it('routes success URL through /api/billing/checkout/complete for onboarding', async () => {
    const req = new NextRequest('http://localhost:3001/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'starter', from: 'onboarding' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://checkout.stripe.com/pay/cs_test');

    const call = mockCreateCheckout.mock.calls[0][0];
    expect(call.successUrl).toContain('/api/billing/checkout/complete');
    expect(call.successUrl).not.toContain('/dashboard?welcome=1');
  });

  it('routes success URL through /api/billing/checkout/complete for billing upgrades', async () => {
    const req = new NextRequest('http://localhost:3001/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro', from: 'billing' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await (POST as any)(req);

    const call = mockCreateCheckout.mock.calls[0][0];
    expect(call.successUrl).toContain('/api/billing/checkout/complete');
    expect(call.successUrl).toContain('from=billing');
  });

  it('returns 400 for an invalid planId', async () => {
    const req = new NextRequest('http://localhost:3001/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 in OSS runtime without calling Core (AC-012)', async () => {
    mockIsOssRuntime.mockReturnValue(true);
    const req = new NextRequest('http://localhost:3001/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'starter', from: 'billing' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(404);
    expect(mockCreateCheckout).not.toHaveBeenCalled();
  });

  it('surfaces Core 410 as billing disabled message (AC-048)', async () => {
    mockCreateCheckout.mockRejectedValueOnce(
      new CoreApiError('Billing is disabled in the OSS build. Checkout is not available.', 410),
    );
    const req = new NextRequest('http://localhost:3001/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'starter', from: 'billing' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/billing is disabled/i);
  });
});
