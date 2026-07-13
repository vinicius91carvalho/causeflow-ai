import { describe, expect, it, vi } from 'vitest';
import { CoreApiError } from '@/lib/api/http-api-client';

const connectStubIntegration = vi.fn().mockResolvedValue({
  integrationId: 'stub-upstream-credential',
  provider: 'stub-upstream',
  status: 'active',
  stubConnectionId: 'conn-1',
  stubBaseUrl: 'http://127.0.0.1:5190',
  connectedAt: '2026-07-11T00:00:00.000Z',
});

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { userId: 'u1', tenantId: 't1' }),
}));

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ connectStubIntegration }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

import { POST } from './stub-connect-handler';

describe('stub-connect-handler', () => {
  it('POSTs through to Core stub connect and returns 201', async () => {
    const req = {
      json: async () => ({}),
      url: 'http://localhost/api/integrations/stub/connect',
      method: 'POST',
    };
    const res = (await POST(req as never, {
      params: Promise.resolve({}),
    })) as Response;
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.provider).toBe('stub-upstream');
    expect(body.stubConnectionId).toBe('conn-1');
    expect(connectStubIntegration).toHaveBeenCalled();
  });

  it('returns upstream status and message when Core connect fails (AC-072)', async () => {
    connectStubIntegration.mockRejectedValueOnce(
      new CoreApiError(
        'Stub upstream unreachable at http://causeflow-test-app:5190: ECONNREFUSED',
        400,
      ),
    );
    const req = {
      json: async () => ({}),
      url: 'http://localhost/api/integrations/stub/connect',
      method: 'POST',
    };
    const res = (await POST(req as never, {
      params: Promise.resolve({}),
    })) as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('unreachable');
  });
});
