import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal route handler shape for test-only casts.
type RouteHandler = (req: unknown, ctx?: unknown) => Promise<Response>;

// Mock withAuth to pass through the handler directly
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: <T>(handler: T): T => handler,
}));

// Mock getApiClient
const mockListAuditEntries = vi.fn();
vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    listAuditEntries: mockListAuditEntries,
  }),
}));

// Must import AFTER mocks
const { GET } = await import('../audit-handler');

const fixtureEntry = {
  entryId: 'audit-1',
  tenantId: 't1',
  action: 'agent.started',
  actorType: 'user',
  actorEmail: 'alice@example.com',
  resourceType: 'incident',
  resourceId: 'incident-mock-1',
  entryHash: 'h1',
  createdAt: '2026-04-07T20:00:00Z',
};

function makeRequest(url = 'http://localhost:3001/api/audit'): Request {
  return new Request(url, { method: 'GET' });
}

describe('audit-handler', () => {
  beforeEach(() => {
    mockListAuditEntries.mockResolvedValue({ items: [fixtureEntry], cursor: undefined });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with items and no cursor when no next page', async () => {
    const req = makeRequest();
    const response = await (GET as RouteHandler)(req, {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toEqual([fixtureEntry]);
    expect(data.cursor).toBeUndefined();
    expect(mockListAuditEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        action: undefined,
        actorType: undefined,
      }),
    );
  });

  it('returns cursor in response when present', async () => {
    mockListAuditEntries.mockResolvedValue({ items: [fixtureEntry], cursor: 'next-page-token' });
    const req = makeRequest();
    const response = await (GET as RouteHandler)(req, {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cursor).toBe('next-page-token');
  });

  it('forwards actorType=user to listAuditEntries', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?actorType=user');
    const response = await (GET as RouteHandler)(req, {});

    expect(response.status).toBe(200);
    expect(mockListAuditEntries).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'user' }),
    );
  });

  it('forwards actorType=system to listAuditEntries', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?actorType=system');
    const response = await (GET as RouteHandler)(req, {});

    expect(response.status).toBe(200);
    expect(mockListAuditEntries).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'system' }),
    );
  });

  it('returns 400 for an invalid actorType', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?actorType=admin');
    const response = await (GET as RouteHandler)(req, {});
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid actorType');
    expect(mockListAuditEntries).not.toHaveBeenCalled();
  });

  it('accepts agent.started action from VALID_ACTIONS', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?action=agent.started');
    const response = await (GET as RouteHandler)(req, {});

    expect(response.status).toBe(200);
    expect(mockListAuditEntries).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'agent.started' }),
    );
  });

  it('accepts investigation.completed action from VALID_ACTIONS', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?action=investigation.completed');
    const response = await (GET as RouteHandler)(req, {});

    expect(response.status).toBe(200);
    expect(mockListAuditEntries).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'investigation.completed' }),
    );
  });

  it('returns 400 for an invalid action', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?action=not.a.valid.action');
    const response = await (GET as RouteHandler)(req, {});
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid action/);
    expect(mockListAuditEntries).not.toHaveBeenCalled();
  });

  it('returns 500 when the underlying client throws', async () => {
    mockListAuditEntries.mockRejectedValue(new Error('Core API unavailable'));
    const req = makeRequest();
    const response = await (GET as RouteHandler)(req, {});
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to load audit entries');
  });

  it('respects the limit query param (default 20, max 100)', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?limit=50');
    await (GET as RouteHandler)(req, {});
    expect(mockListAuditEntries).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it('clamps limit to 100', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?limit=999');
    await (GET as RouteHandler)(req, {});
    expect(mockListAuditEntries).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('forwards the cursor query param to listAuditEntries', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?cursor=page-token-abc');
    await (GET as RouteHandler)(req, {});
    expect(mockListAuditEntries).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'page-token-abc' }),
    );
  });

  it('does not include cursor in the call when not provided', async () => {
    const req = makeRequest('http://localhost:3001/api/audit');
    await (GET as RouteHandler)(req, {});
    const call = mockListAuditEntries.mock.calls[0][0] as Record<string, unknown>;
    expect(call.cursor).toBeUndefined();
  });

  it('does not forward resourceType as a filter param', async () => {
    const req = makeRequest('http://localhost:3001/api/audit?resourceType=incident');
    const response = await (GET as RouteHandler)(req, {});

    expect(response.status).toBe(200);
    expect(mockListAuditEntries).toHaveBeenCalledWith(
      expect.not.objectContaining({ resourceType: expect.anything() }),
    );
  });
});

describe('audit-handler — invariant grep', () => {
  it('does not import ALLOWED_AUDIT_RESOURCE_TYPES', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../audit-handler.ts', import.meta.url), 'utf-8');
    expect(source).not.toContain('ALLOWED_AUDIT_RESOURCE_TYPES');
  });

  it('validates actorType server-side', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../audit-handler.ts', import.meta.url), 'utf-8');
    expect(source).toContain('Invalid actorType');
  });
});
