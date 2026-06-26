import type { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: NextRequest) => Promise<NextResponse>) => handler,
}));

const mockGetSentryStatus = vi.fn();
const mockSaveSentryClientSecret = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    getSentryIntegrationStatus: mockGetSentryStatus,
    saveSentryClientSecret: mockSaveSentryClientSecret,
  }),
}));

import {
  handleGetSentryIntegration,
  handleSaveSentryIntegration,
} from '../sentry-integration-handler';

function makeRequest(method: string, body?: unknown): NextRequest {
  return {
    method,
    json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
  } as unknown as NextRequest;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleGetSentryIntegration', () => {
  it('returns the SentryIntegrationStatus payload from the api client', async () => {
    const status = {
      hasClientSecret: true,
      verified: false,
      verifiedAt: null,
      lastEventAt: null,
      triggers: [],
    };
    mockGetSentryStatus.mockResolvedValue(status);

    const res = await handleGetSentryIntegration(makeRequest('GET'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(status);
    expect(mockGetSentryStatus).toHaveBeenCalledOnce();
  });

  it('returns 500 on api client error', async () => {
    mockGetSentryStatus.mockRejectedValue(new Error('upstream'));
    const res = await handleGetSentryIntegration(makeRequest('GET'));
    expect(res.status).toBe(500);
  });
});

describe('handleSaveSentryIntegration', () => {
  it('forwards a non-empty Client Secret to the api client and returns its result', async () => {
    const result = { hasClientSecret: true, verified: false };
    mockSaveSentryClientSecret.mockResolvedValue(result);

    const req = makeRequest('POST', { clientSecret: 'sk_sentry_abc123' });
    const res = await handleSaveSentryIntegration(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(mockSaveSentryClientSecret).toHaveBeenCalledWith('sk_sentry_abc123');
  });

  it('returns 400 when clientSecret is missing', async () => {
    const req = makeRequest('POST', {});
    const res = await handleSaveSentryIntegration(req);
    expect(res.status).toBe(400);
    expect(mockSaveSentryClientSecret).not.toHaveBeenCalled();
  });

  it('returns 400 when clientSecret is an empty string', async () => {
    const req = makeRequest('POST', { clientSecret: '' });
    const res = await handleSaveSentryIntegration(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when clientSecret is whitespace only', async () => {
    const req = makeRequest('POST', { clientSecret: '   ' });
    const res = await handleSaveSentryIntegration(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when clientSecret is not a string', async () => {
    const req = makeRequest('POST', { clientSecret: 123 });
    const res = await handleSaveSentryIntegration(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid JSON', async () => {
    const req = makeRequest('POST');
    const res = await handleSaveSentryIntegration(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 on upstream api error — never echoes the secret', async () => {
    mockSaveSentryClientSecret.mockRejectedValue(new Error('upstream failed'));
    const req = makeRequest('POST', { clientSecret: 'sk_dont_leak_this' });
    const res = await handleSaveSentryIntegration(req);

    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    // The error MUST NOT contain the secret value
    expect(json.error).not.toContain('sk_dont_leak_this');
  });

  it('source does NOT log the request body', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../sentry-integration-handler.ts', import.meta.url),
      'utf-8',
    );
    expect(source).not.toMatch(/console\.(log|warn|error|debug|info)/);
    // Best-effort: handler should not log `body` or `clientSecret` anywhere
    expect(source).not.toMatch(/log\([^)]*body/i);
    expect(source).not.toMatch(/log\([^)]*clientSecret/i);
  });
});

describe('handler — security invariants', () => {
  it('handler module never reads tenantId from the request body', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../sentry-integration-handler.ts', import.meta.url),
      'utf-8',
    );
    // W4: tenantId must come from Core's JWT extraction, never from the body
    expect(source).not.toContain('body.tenantId');
    expect(source).not.toContain("'tenantId'");
  });
});
