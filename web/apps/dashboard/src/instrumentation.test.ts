import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureRequestError: vi.fn(),
  init: vi.fn(),
  replayIntegration: vi.fn(() => ({})),
}));

// Mock the sentry config files so register() doesn't actually call Sentry.init
vi.mock('../sentry.server.config', () => ({}));
vi.mock('../sentry.edge.config', () => ({}));

describe('instrumentation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports onRequestError as Sentry.captureRequestError', async () => {
    const sentry = (await import('@sentry/nextjs')) as unknown as {
      captureRequestError: ReturnType<typeof vi.fn>;
    };
    const { onRequestError } = await import('./instrumentation');
    expect(onRequestError).toBe(sentry.captureRequestError);
  });

  it('register() resolves without throwing when NEXT_RUNTIME=nodejs', async () => {
    const original = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = 'nodejs';

    const { register } = await import('./instrumentation');
    await expect(register()).resolves.toBeUndefined();

    process.env.NEXT_RUNTIME = original;
  });

  it('register() resolves without throwing when NEXT_RUNTIME=edge', async () => {
    const original = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = 'edge';

    const { register } = await import('./instrumentation');
    await expect(register()).resolves.toBeUndefined();

    process.env.NEXT_RUNTIME = original;
  });

  it('register() resolves without throwing when NEXT_RUNTIME is not set', async () => {
    const original = process.env.NEXT_RUNTIME;
    delete process.env.NEXT_RUNTIME;

    const { register } = await import('./instrumentation');
    await expect(register()).resolves.toBeUndefined();

    process.env.NEXT_RUNTIME = original;
  });
});
