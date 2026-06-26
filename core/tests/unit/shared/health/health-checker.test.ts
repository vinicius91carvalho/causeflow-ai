import { describe, it, expect, vi } from 'vitest';
import { HealthChecker } from '../../../../src/shared/infra/health/health-checker.js';
import type { HealthCheck } from '../../../../src/shared/infra/health/health-checker.js';

function createCheck(name: string, status: 'ok' | 'degraded' | 'down', latencyMs = 10): HealthCheck {
  return {
    name,
    check: vi.fn().mockResolvedValue({ name, status, latencyMs }),
  };
}

describe('HealthChecker', () => {
  it('should return ok when all checks pass', async () => {
    const checker = new HealthChecker();
    checker.register(createCheck('db', 'ok'));
    checker.register(createCheck('redis', 'ok'));

    const result = await checker.runAll();
    expect(result.status).toBe('ok');
    expect(result.checks).toHaveLength(2);
    expect(result.timestamp).toBeDefined();
  });

  it('should return degraded when any check is degraded', async () => {
    const checker = new HealthChecker();
    checker.register(createCheck('db', 'ok'));
    checker.register(createCheck('redis', 'degraded'));

    const result = await checker.runAll();
    expect(result.status).toBe('degraded');
  });

  it('should return down when any check is down', async () => {
    const checker = new HealthChecker();
    checker.register(createCheck('db', 'down'));
    checker.register(createCheck('redis', 'ok'));

    const result = await checker.runAll();
    expect(result.status).toBe('down');
  });

  it('should handle check that throws error', async () => {
    const checker = new HealthChecker();
    checker.register({
      name: 'failing',
      check: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });

    const result = await checker.runAll();
    expect(result.status).toBe('down');
    expect(result.checks[0]!.status).toBe('down');
    expect(result.checks[0]!.details?.['error']).toBe('Connection refused');
  });

  it('should return ok with empty checks', async () => {
    const checker = new HealthChecker();
    const result = await checker.runAll();
    expect(result.status).toBe('ok');
    expect(result.checks).toHaveLength(0);
  });

  it('should down overrides degraded', async () => {
    const checker = new HealthChecker();
    checker.register(createCheck('a', 'degraded'));
    checker.register(createCheck('b', 'down'));

    const result = await checker.runAll();
    expect(result.status).toBe('down');
  });
});
