import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/session-auth', () => ({
  getSessionFromRequest: vi.fn().mockResolvedValue({
    sub: 'user_1',
    tenantId: 'org_1',
    orgId: 'org_1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
  }),
  verifySessionCookie: vi.fn().mockResolvedValue({
    sub: 'user_1',
    tenantId: 'org_1',
    orgId: 'org_1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
  }),
  SESSION_COOKIE: '__session',
}));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => '127.0.0.1',
  rateLimit: () => ({ success: true }),
}));

import { POST } from './complete-profile-handler';

describe('POST /api/onboarding/complete-profile', () => {
  it('returns 200 with tenantId when user has tenant in claims', async () => {
    const req = new NextRequest('http://localhost/api/onboarding/complete-profile', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tenantId).toBe('org_1');
  });

  it('returns 200 with full profile data', async () => {
    const req = new NextRequest('http://localhost/api/onboarding/complete-profile', {
      method: 'POST',
      body: JSON.stringify({ teamSize: '1_5', fullName: 'Alice', role: 'CTO' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tenantId).toBe('org_1');
  });

  it('returns 401 when not authenticated', async () => {
    const sessionAuth = await import('@/lib/auth/session-auth');
    vi.mocked(sessionAuth.getSessionFromRequest).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/onboarding/complete-profile', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with mock tenant when no tenant in claims and no CORE_API_URL', async () => {
    const sessionAuth = await import('@/lib/auth/session-auth');
    vi.mocked(sessionAuth.getSessionFromRequest).mockResolvedValueOnce({
      sub: 'user_1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
    });

    const req = new NextRequest('http://localhost/api/onboarding/complete-profile', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await (POST as any)(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tenantId).toBe('mock-tenant');
  });
});
