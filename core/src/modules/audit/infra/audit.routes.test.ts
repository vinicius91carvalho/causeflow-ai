import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AuditUseCases } from './audit.routes.js';
import { createAuditRoutes } from './audit.routes.js';

// Minimal Hono AppEnv stub
type MockEnv = { Variables: { tenantId: string; userEmail: string; userId: string } };

function makeApp(useCases: Partial<AuditUseCases>) {
  const app = new Hono<MockEnv>();
  // Inject tenantId into context like auth middleware would
  app.use('*', async (c, next) => {
    c.set('tenantId', 'tenant-test' as never);
    c.set('userEmail', 'test@example.com' as never);
    c.set('userId', 'user-1' as never);
    await next();
  });
  app.route('/', createAuditRoutes(useCases as AuditUseCases));
  return app;
}

describe('audit.routes — GET / actorType param validation', () => {
  const executeMock = vi.fn().mockResolvedValue({ items: [], cursor: undefined });

  beforeEach(() => {
    vi.clearAllMocks();
    executeMock.mockResolvedValue({ items: [], cursor: undefined });
  });

  it('returns 400 when actorType is an invalid value', async () => {
    const app = makeApp({
      listAuditEntries: { execute: executeMock } as never,
      verifyHashChain: { execute: vi.fn().mockResolvedValue({}) } as never,
      exportAudit: { execute: vi.fn() } as never,
    });

    const res = await app.request('/?actorType=admin');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid actorType');
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('passes actorType=user to the use case when valid', async () => {
    const app = makeApp({
      listAuditEntries: { execute: executeMock } as never,
      verifyHashChain: { execute: vi.fn().mockResolvedValue({}) } as never,
      exportAudit: { execute: vi.fn() } as never,
    });

    const res = await app.request('/?actorType=user');
    expect(res.status).toBe(200);
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'user' }),
    );
  });

  it('passes actorType=system to the use case when valid', async () => {
    const app = makeApp({
      listAuditEntries: { execute: executeMock } as never,
      verifyHashChain: { execute: vi.fn().mockResolvedValue({}) } as never,
      exportAudit: { execute: vi.fn() } as never,
    });

    const res = await app.request('/?actorType=system');
    expect(res.status).toBe(200);
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'system' }),
    );
  });

  it('omits actorType from use case input when param is not present', async () => {
    const app = makeApp({
      listAuditEntries: { execute: executeMock } as never,
      verifyHashChain: { execute: vi.fn().mockResolvedValue({}) } as never,
      exportAudit: { execute: vi.fn() } as never,
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(executeMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ actorType: expect.anything() }),
    );
  });
});
