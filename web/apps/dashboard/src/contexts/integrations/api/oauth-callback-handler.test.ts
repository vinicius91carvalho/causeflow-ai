import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  // Mirror real withAuth: resolve routeContext.params Promise, pass as third arg to handler
  withAuth:
    (handler: (req: unknown, ctx: unknown, params: unknown) => Promise<unknown>) =>
    async (req: unknown, routeContext: { params: Promise<unknown> }) => {
      const params = routeContext?.params ? await routeContext.params : undefined;
      return handler(req, {}, params);
    },
}));

const mockFinalizeComposioConnection = vi.fn();
const mockStoreOAuthToken = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    finalizeComposioConnection: mockFinalizeComposioConnection,
    storeOAuthToken: mockStoreOAuthToken,
  }),
}));

import { GET } from './oauth-callback-handler';

function makeRequest(url: string): Request {
  return new Request(url);
}

describe('oauth-callback-handler', () => {
  it('GET is exported', () => {
    expect(GET).toBeDefined();
  });

  describe('error param', () => {
    it('returns popup failure HTML on error param', async () => {
      const req = makeRequest(
        'http://localhost/api/integrations/oauth/trello/callback?error=access_denied',
      );
      const res = await GET(req as any, { params: Promise.resolve({ provider: 'trello' }) });
      expect(res.headers.get('Content-Type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('Authorization denied');
      expect(body).toContain('window.opener.postMessage');
    });
  });

  describe('classic code path', () => {
    it('calls storeOAuthToken and returns popup success HTML', async () => {
      mockStoreOAuthToken.mockResolvedValueOnce({});
      const req = makeRequest(
        'http://localhost/api/integrations/oauth/github/callback?code=abc123&state=xyz',
      );
      const res = await GET(req as any, { params: Promise.resolve({ provider: 'github' }) });
      expect(res.headers.get('Content-Type')).toContain('text/html');
      const body = await res.text();
      expect(body).toContain('Authorization successful');
      expect(body).toContain('window.opener.postMessage');
      expect(mockStoreOAuthToken).toHaveBeenCalledWith('github', { code: 'abc123', state: 'xyz' });
    });

    it('returns popup failure HTML on storeOAuthToken error', async () => {
      mockStoreOAuthToken.mockRejectedValueOnce(new Error('Token exchange failed'));
      const req = makeRequest(
        'http://localhost/api/integrations/oauth/slack/callback?code=badcode',
      );
      const res = await GET(req as any, { params: Promise.resolve({ provider: 'slack' }) });
      const body = await res.text();
      expect(body).toContain('Token exchange failed');
      expect(body).toContain('window.opener.postMessage');
    });
  });

  describe('Composio connected_account_id path', () => {
    it('redirects to /dashboard/integrations?connected=<provider> on success', async () => {
      mockFinalizeComposioConnection.mockResolvedValueOnce(undefined);
      const req = makeRequest(
        'http://localhost/api/integrations/oauth/trello/callback?connected_account_id=acc_123&status=success',
      );
      const res = await GET(req as any, { params: Promise.resolve({ provider: 'trello' }) });
      expect(res.status).toBe(307);
      const location = res.headers.get('location') ?? '';
      expect(location).toContain('/dashboard/integrations');
      expect(location).toContain('connected=trello');
    });

    it('redirects with connect_error on finalizeComposioConnection failure', async () => {
      mockFinalizeComposioConnection.mockRejectedValueOnce(new Error('Core API error'));
      const req = makeRequest(
        'http://localhost/api/integrations/oauth/trello/callback?connected_account_id=acc_bad',
      );
      const res = await GET(req as any, { params: Promise.resolve({ provider: 'trello' }) });
      expect(res.status).toBe(307);
      const location = res.headers.get('location') ?? '';
      expect(location).toContain('/dashboard/integrations');
      expect(location).toContain('connect_error=');
    });

    it('rejects unknown provider and redirects cleanly', async () => {
      const req = makeRequest(
        'http://localhost/api/integrations/oauth/evil-provider/callback?connected_account_id=acc_123',
      );
      const res = await GET(req as any, { params: Promise.resolve({ provider: 'evil-provider' }) });
      // Should redirect without toast params (security: unknown provider)
      expect(res.status).toBe(307);
      const location = res.headers.get('location') ?? '';
      expect(location).toContain('/dashboard/integrations');
      expect(location).not.toContain('connected=');
    });

    it('handles status=success alone (no connected_account_id)', async () => {
      mockFinalizeComposioConnection.mockResolvedValueOnce(undefined);
      const req = makeRequest(
        'http://localhost/api/integrations/oauth/trello/callback?status=success',
      );
      const res = await GET(req as any, { params: Promise.resolve({ provider: 'trello' }) });
      expect(res.status).toBe(307);
      const location = res.headers.get('location') ?? '';
      expect(location).toContain('connected=trello');
    });
  });

  describe('fallback — missing code and no Composio params', () => {
    it('returns popup failure HTML for missing authorization code', async () => {
      const req = makeRequest('http://localhost/api/integrations/oauth/trello/callback');
      const res = await GET(req as any, { params: Promise.resolve({ provider: 'trello' }) });
      const body = await res.text();
      expect(body).toContain('Missing authorization code');
      expect(body).toContain('window.opener.postMessage');
    });
  });

  describe('missing provider', () => {
    it('returns 400 when provider is missing', async () => {
      const req = makeRequest('http://localhost/api/integrations/oauth//callback?code=abc');
      const res = await GET(req as any, { params: Promise.resolve({ provider: '' }) });
      expect(res.status).toBe(400);
    });
  });
});
