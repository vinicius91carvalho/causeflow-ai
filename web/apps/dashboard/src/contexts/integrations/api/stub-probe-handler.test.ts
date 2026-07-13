import { describe, expect, it, vi } from 'vitest';
import { CoreApiError } from '@/lib/api/http-api-client';

const probeStubIntegration = vi.fn().mockResolvedValue({
  success: true,
  message: 'Stub upstream probe succeeded',
  probeCount: 1,
  stubState: {},
  probedAt: '2026-07-11T00:00:00.000Z',
});

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { userId: 'u1', tenantId: 't1' }),
}));

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({ probeStubIntegration }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

import { POST } from './stub-probe-handler';

describe('stub-probe-handler (AC-072)', () => {
  it('POSTs through to Core stub probe and returns success', async () => {
    const req = {
      url: 'http://localhost/api/integrations/stub/probe',
      method: 'POST',
    };
    const res = (await POST(req as never, {
      params: Promise.resolve({}),
    })) as Response;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('probe succeeded');
    expect(probeStubIntegration).toHaveBeenCalled();
  });

  it('returns success:false with unreachable message when Core probe fails', async () => {
    probeStubIntegration.mockRejectedValueOnce(
      new CoreApiError(
        'Stub upstream unreachable at http://causeflow-test-app:5190: fetch failed',
        400,
      ),
    );
    const req = {
      url: 'http://localhost/api/integrations/stub/probe',
      method: 'POST',
    };
    const res = (await POST(req as never, {
      params: Promise.resolve({}),
    })) as Response;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('unreachable');
  });
});
