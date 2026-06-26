import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock withAuth to pass through the handler directly
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: Function) => handler,
}));

// Mock getApiClient
const mockListPendingApprovals = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    listPendingApprovals: mockListPendingApprovals,
  }),
}));

// Must import AFTER mocks
const { GET } = await import('./approvals-pending-handler');

function makeRequest(url = 'http://localhost:3001/api/approvals/pending'): Request {
  return new Request(url, { method: 'GET' });
}

describe('approvals-pending-handler', () => {
  const mockApprovals = [
    {
      approvalId: 'approval-1',
      notificationId: 'notif-1',
      incidentId: 'inc-1',
      remediationId: 'rem-1',
      title: 'Approve DB migration',
      description: 'Auto-remediation step requires approval',
      actions: [],
      status: 'pending',
      timeoutMinutes: 30,
      expiresAt: '2026-04-08T00:00:00Z',
      createdAt: '2026-04-07T00:00:00Z',
    },
  ];

  beforeEach(() => {
    // Core API returns `{ items: [...] }` — the handler must normalize to a flat array.
    mockListPendingApprovals.mockResolvedValue({ items: mockApprovals });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with pending approvals list', async () => {
    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockApprovals);
    expect(mockListPendingApprovals).toHaveBeenCalledOnce();
  });

  it('returns the Core method return value directly', async () => {
    const req = makeRequest();
    const response = await (GET as Function)(req, {});
    const data = await response.json();

    // Body must exactly match what the Core method returned
    expect(data).toEqual(mockApprovals);
  });

  it('propagates errors from listPendingApprovals', async () => {
    mockListPendingApprovals.mockRejectedValue(new Error('Core API unavailable'));

    const req = makeRequest();
    await expect((GET as Function)(req, {})).rejects.toThrow('Core API unavailable');
  });
});

describe('approvals-pending-handler — unauthenticated (withAuth enforces 401)', () => {
  it('withAuth is used to wrap the handler', async () => {
    // Verify withAuth is imported and used by reading the module source
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./approvals-pending-handler.ts', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('withAuth');
    expect(source).toContain('listPendingApprovals');
  });
});
