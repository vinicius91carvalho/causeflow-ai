import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown) => Promise<unknown>) => (req: unknown) => handler(req),
}));

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    getOAuthStatus: vi.fn().mockResolvedValue({ integrations: [] }),
    connectCredential: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

import { GET, POST } from './integrations-handler';

describe('integrations-handler', () => {
  it('GET is exported', () => {
    expect(GET).toBeDefined();
  });

  it('POST is exported', () => {
    expect(POST).toBeDefined();
  });
});
