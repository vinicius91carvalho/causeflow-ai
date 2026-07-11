import { describe, expect, it, vi } from 'vitest';

const enableStubConnector = vi.fn().mockResolvedValue({
  integrationId: 'datadog-stub-credential',
  provider: 'datadog',
  status: 'active',
  stubBaseUrl: 'http://127.0.0.1:5190',
  linkedTo: 'stub-upstream',
  connectedAt: '2026-07-11T00:00:00.000Z',
});

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { userId: 'u1', tenantId: 't1' }),
}));

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ enableStubConnector }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

import { POST } from './stub-enable-handler';

describe('stub-enable-handler', () => {
  it('POSTs through to Core stub enable and returns 201', async () => {
    const req = {
      json: async () => ({ provider: 'datadog' }),
      url: 'http://localhost/api/integrations/stub/enable',
      method: 'POST',
    };
    const res = (await POST(req as never, {
      params: Promise.resolve({}),
    })) as Response;
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.provider).toBe('datadog');
    expect(body.linkedTo).toBe('stub-upstream');
    expect(enableStubConnector).toHaveBeenCalledWith({ provider: 'datadog' });
  });

  it('returns 400 when provider is missing', async () => {
    enableStubConnector.mockClear();
    const req = {
      json: async () => ({}),
      url: 'http://localhost/api/integrations/stub/enable',
      method: 'POST',
    };
    const res = (await POST(req as never, {
      params: Promise.resolve({}),
    })) as Response;
    expect(res.status).toBe(400);
    expect(enableStubConnector).not.toHaveBeenCalled();
  });
});
