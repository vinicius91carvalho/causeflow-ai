/**
 * AC-074 — POST /api/incidents never enforces a local credits ledger.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createIncident = vi.fn();
const getSubscription = vi.fn();

vi.mock('@/lib/api/get-api-client', () => ({
  getApiClient: () => ({
    createIncident,
    getSubscription,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/api/with-auth', () => ({
  withAuth:
    (fn: (req: NextRequest, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: NextRequest) =>
      fn(req, {
        userId: 'user_test',
        tenantId: 'tenant_test',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        profileComplete: true,
        isStaff: false,
      }),
}));

beforeEach(() => {
  createIncident.mockReset();
  getSubscription.mockReset();
});

describe('POST /api/incidents (AC-074)', () => {
  it('creates without consumeCredit / CREDITS_EXHAUSTED gate', async () => {
    createIncident.mockResolvedValueOnce({ incidentId: 'inc_ac074', status: 'queued' });
    const { POST } = await import('./incidents-create-handler');
    const req = new NextRequest('http://localhost:3001/api/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'AC-074 incident title long enough',
        description: 'Prove OSS create path ignores commercial credit quotas.',
        severity: 'high',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(createIncident).toHaveBeenCalledTimes(1);
    expect(getSubscription).not.toHaveBeenCalled();
    const body = (await res.json()) as { code?: string };
    expect(body.code).not.toBe('CREDITS_EXHAUSTED');
  });

  it('source does not import credits-ledger', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./incidents-create-handler.ts', import.meta.url), 'utf-8');
    expect(source).not.toContain('credits-ledger');
    expect(source).not.toContain('consumeCredit');
    expect(source).not.toContain('CREDITS_EXHAUSTED');
  });
});
