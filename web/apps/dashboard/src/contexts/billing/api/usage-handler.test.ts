import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock withAuth to pass through the handler directly
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: Function) => handler,
}));

// Mock getApiClient
const mockGetUsageHistory = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    getUsageHistory: mockGetUsageHistory,
  }),
}));

// Must import AFTER mocks
const { GET } = await import('./usage-handler');

function makeRequest(url = 'http://localhost:3001/api/billing/usage'): Request {
  return new Request(url, { method: 'GET' });
}

describe('usage-handler', () => {
  const records = [
    { date: '2026-04-01', count: 3, type: 'investigations' },
    { date: '2026-04-02', count: 1, type: 'investigations' },
  ];
  const mockUsage = {
    records,
    cursor: null,
    account: null,
  };
  const expectedBody = {
    items: records,
    cursor: null,
    account: null,
  };

  beforeEach(() => {
    mockGetUsageHistory.mockResolvedValue(mockUsage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and normalizes Core `{ records }` to `{ items }`', async () => {
    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(expectedBody);
    expect(mockGetUsageHistory).toHaveBeenCalledOnce();
  });

  it('forwards `items` as-is when Core already returns the normalized shape', async () => {
    mockGetUsageHistory.mockResolvedValueOnce({ items: records, cursor: 'c1', account: null });
    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    const data = await response.json();

    expect(data).toEqual({ items: records, cursor: 'c1', account: null });
  });

  it('propagates errors from getUsageHistory', async () => {
    mockGetUsageHistory.mockRejectedValue(new Error('Core API unavailable'));

    const req = makeRequest();
    await expect((GET as Function)(req, {})).rejects.toThrow('Core API unavailable');
  });
});

describe('usage-handler — auth contract', () => {
  it('withAuth is used to wrap the handler', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./usage-handler.ts', import.meta.url), 'utf-8');
    expect(source).toContain('withAuth');
    expect(source).toContain('getUsageHistory');
  });
});
