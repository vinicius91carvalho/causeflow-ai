import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppLifecycle } from '../../../src/lifecycle.js';

vi.mock('../../../src/shared/infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Prevent actual process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

describe('AppLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register components', () => {
    const lifecycle = new AppLifecycle();
    lifecycle.register({ name: 'test', shutdown: vi.fn() });
    // No error
  });

  it('should shutdown all components in order', async () => {
    const order: string[] = [];
    const lifecycle = new AppLifecycle(5000);

    lifecycle.register({
      name: 'first',
      shutdown: vi.fn(async () => { order.push('first'); }),
    });
    lifecycle.register({
      name: 'second',
      shutdown: vi.fn(async () => { order.push('second'); }),
    });

    await lifecycle.shutdown();

    expect(order).toEqual(['first', 'second']);
  });

  it('should handle component shutdown failures gracefully', async () => {
    const lifecycle = new AppLifecycle(5000);

    lifecycle.register({
      name: 'failing',
      shutdown: vi.fn().mockRejectedValue(new Error('shutdown error')),
    });
    lifecycle.register({
      name: 'succeeding',
      shutdown: vi.fn().mockResolvedValue(undefined),
    });

    await lifecycle.shutdown();

    // Both components attempted
    expect(mockExit).toHaveBeenCalled();
  });

  it('should only shutdown once (idempotent)', async () => {
    const shutdownFn = vi.fn();
    const lifecycle = new AppLifecycle(5000);
    lifecycle.register({ name: 'test', shutdown: shutdownFn });

    await lifecycle.shutdown();
    await lifecycle.shutdown();

    expect(shutdownFn).toHaveBeenCalledTimes(1);
  });
});
