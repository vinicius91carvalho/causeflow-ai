import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { tenantId: 't1', role: 'member' }),
}));

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    createPortalSession: vi.fn().mockResolvedValue({ url: 'https://stripe.test/portal' }),
  }),
}));

import { POST } from './portal-handler';

describe('billing portal handler', () => {
  it('exports POST', () => {
    expect(POST).toBeDefined();
  });
});
