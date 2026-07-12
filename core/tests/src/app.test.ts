import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AppContext } from '../../src/bootstrap.js';

/**
 * Sprint 3 / Invariant I5 — `/health` response shape contract.
 *
 * The `commit` field is read from `process.env.APP_VERSION`, which is baked
 * into the Docker runtime stage via `ARG GIT_SHA`. The `verify-deploy.ts`
 * script asserts `commit === expectedSha.slice(0, 7)` after every staging
 * deploy, so this shape is load-bearing for the CI pipeline.
 */

function buildMinimalCtx(): AppContext {
  const fakeHealthChecker = {
    register: () => {},
    runAll: async () => ({
      status: 'ok' as const,
      checks: [],
      timestamp: '2026-04-11T22:00:00.000Z',
    }),
    checks: [],
  };

  // Only the fields createApp actually touches at /health time.
  // Cast through unknown so TS does not complain about the trimmed surface.
  return {
    healthChecker: fakeHealthChecker,
    corsOrigins: ['http://localhost:3000'],
    tenantUseCases: {} as never,
    auditUseCases: {} as never,
    webhookUseCases: {} as never,
    incidentUseCases: {} as never,
    triageUseCases: {} as never,
    investigationUseCases: {} as never,
    remediationUseCases: {} as never,
    notificationUseCases: {} as never,
    analyticsUseCases: {} as never,
    apiKeyUseCases: {} as never,
    adminDeps: {} as never,
    codeKnowledgeUseCases: {} as never,
    memoryUseCases: {} as never,
    userUseCases: {} as never,
    billingUseCases: {} as never,
    integrationUseCases: {} as never,
    authUseCases: {} as never,
  } as unknown as AppContext;
}

describe('GET /health', () => {
  const originalAppVersion = process.env['APP_VERSION'];

  beforeEach(() => {
    delete process.env['APP_VERSION'];
  });

  afterEach(() => {
    if (originalAppVersion === undefined) {
      delete process.env['APP_VERSION'];
    } else {
      process.env['APP_VERSION'] = originalAppVersion;
    }
  });

  it('returns the full Sprint 3 shape (status, service, version, commit, timestamp)', async () => {
    process.env['APP_VERSION'] = 'abc1234';
    const app = createApp(buildMinimalCtx());

    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    // I5 contract: exactly these six keys, no more, no less.
    expect(Object.keys(body).sort()).toEqual(
      ['checks', 'commit', 'service', 'status', 'timestamp', 'version'].sort(),
    );

    expect(body['status']).toBe('ok');
    expect(body['service']).toBe('causeflow');
    expect(body['version']).toBe('0.1.0');
    expect(body['commit']).toBe('abc1234');
    expect(typeof body['timestamp']).toBe('string');
    expect(body['checks']).toEqual({});
  });

  it('returns commit="unknown" when APP_VERSION is not set', async () => {
    // beforeEach already cleared APP_VERSION
    const app = createApp(buildMinimalCtx());

    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body['commit']).toBe('unknown');
  });

  it('keeps version as the package.json semver, not the commit SHA', async () => {
    // Even when APP_VERSION is set, version must remain the semver from
    // package.json. Conflating the two would break any future semver consumer.
    process.env['APP_VERSION'] = 'deadbee';
    const app = createApp(buildMinimalCtx());

    const res = await app.request('/health');
    const body = (await res.json()) as Record<string, unknown>;

    expect(body['version']).toBe('0.1.0');
    expect(body['version']).not.toBe('deadbee');
  });

  it('returns 503 when health checker reports down', async () => {
    const ctx = buildMinimalCtx();
    (ctx.healthChecker as { runAll: () => Promise<unknown> }).runAll = async () => ({
      status: 'down' as const,
      checks: [],
      timestamp: '2026-04-11T22:00:00.000Z',
    });
    process.env['APP_VERSION'] = 'abc1234';

    const app = createApp(ctx);
    const res = await app.request('/health');
    expect(res.status).toBe(503);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body['status']).toBe('down');
    // Even on failure, the shape contract holds.
    expect(body['commit']).toBe('abc1234');
  });
});
