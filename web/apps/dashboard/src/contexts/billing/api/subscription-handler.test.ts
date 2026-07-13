import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => (req: unknown) =>
    handler(req, { tenantId: 't1', role: 'member' }),
}));

import { GET } from './subscription-handler';

describe('GET /api/billing/subscription', () => {
  it('returns 410 Gone with billing disabled message (AC-074 / AC-076)', async () => {
    const res = await (GET as any)(new NextRequest('http://localhost/api/billing/subscription'));
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.error).toMatch(/billing is disabled/i);
    expect(body).not.toHaveProperty('creditsTotal');
    expect(body).not.toHaveProperty('creditsRemaining');
    expect(body).not.toHaveProperty('creditsUsed');
  });
});
