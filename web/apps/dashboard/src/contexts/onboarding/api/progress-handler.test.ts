import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// Mock withAuth to pass through
vi.mock('@/lib/api/with-auth', () => ({
  withAuth: (handler: Function) => handler,
}));

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({
    userId: 'user-1',
    orgId: 'org-1',
    orgRole: 'org:admin',
    sessionClaims: { email: 'test@example.com', name: 'Test User' },
  }),
}));

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockReturnValue({ success: true, resetAt: Date.now() + 60000 }),
}));

import { GET, PATCH } from './progress-handler';

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
  length: 0,
  key: vi.fn(() => null),
});

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost:3001/api/onboarding/progress', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Onboarding Progress Handler', () => {
  beforeEach(() => {
    (localStorage.clear as Mock)();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  describe('GET', () => {
    it('returns null progress when no record exists', async () => {
      const req = makeRequest('GET');
      const response = await (GET as Function)(req);
      const data = await response.json();

      expect(data.progress).toBeNull();
    });
  });

  describe('PATCH', () => {
    it('creates initial progress with start action', async () => {
      const req = makeRequest('PATCH', { action: 'start' });
      const response = await (PATCH as Function)(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.progress.currentStep).toBe('welcome');
      expect(data.progress.completed).toBe(false);
    });

    it('completes a step', async () => {
      // First start
      await (PATCH as Function)(makeRequest('PATCH', { action: 'start' }));

      // Then complete welcome
      const req = makeRequest('PATCH', { step: 'welcome', action: 'complete' });
      const response = await (PATCH as Function)(req);
      const data = await response.json();

      expect(data.progress.steps.welcome).toBe('completed');
      expect(data.progress.currentStep).toBe('integrations');
    });

    it('skips all with skip_all action', async () => {
      await (PATCH as Function)(makeRequest('PATCH', { action: 'start' }));

      const req = makeRequest('PATCH', { action: 'skip_all' });
      const response = await (PATCH as Function)(req);
      const data = await response.json();

      expect(data.progress.skipped).toBe(true);
    });

    it('returns 400 for invalid action', async () => {
      const req = makeRequest('PATCH', { action: 'invalid' });
      const response = await (PATCH as Function)(req);

      expect(response.status).toBe(400);
    });

    it('returns 404 when completing step without existing progress', async () => {
      const req = makeRequest('PATCH', { step: 'welcome', action: 'complete' });
      const response = await (PATCH as Function)(req);

      expect(response.status).toBe(404);
    });
  });
});
