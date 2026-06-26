import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}));

describe('error-tracker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('captureException', () => {
    it('calls Sentry.captureException with error and context when DSN is set', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/1';

      const sentry = await import('@sentry/nextjs');
      const { captureException } = await import('./error-tracker');
      const err = new Error('boom');
      captureException(err, { userId: 'u1', tenantId: 't1' });

      expect(sentry.captureException).toHaveBeenCalledWith(err, {
        extra: { userId: 'u1', tenantId: 't1' },
      });

      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });

    it('falls back to console.error when DSN is not configured', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const sentry = await import('@sentry/nextjs');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { captureException } = await import('./error-tracker');
      captureException(new Error('boom'));

      expect(consoleSpy).toHaveBeenCalled();
      expect(sentry.captureException).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });
  });

  describe('captureMessage', () => {
    it('calls Sentry.captureMessage with message, level and context when DSN is set', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/1';

      const sentry = await import('@sentry/nextjs');
      const { captureMessage } = await import('./error-tracker');
      captureMessage('hello', 'warning', { userId: 'u1' });

      expect(sentry.captureMessage).toHaveBeenCalledWith('hello', {
        level: 'warning',
        extra: { userId: 'u1' },
      });

      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });

    it('forwards undefined context as extra when no context provided', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/1';

      const sentry = await import('@sentry/nextjs');
      const { captureMessage } = await import('./error-tracker');
      captureMessage('hello', 'info');

      expect(sentry.captureMessage).toHaveBeenCalledWith('hello', {
        level: 'info',
        extra: undefined,
      });

      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });

    it('falls back to console when DSN is not configured', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const sentry = await import('@sentry/nextjs');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { captureMessage } = await import('./error-tracker');
      captureMessage('watch out', 'warning');

      expect(consoleSpy).toHaveBeenCalled();
      expect(sentry.captureMessage).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });
  });

  describe('setUserContext', () => {
    it('calls Sentry.setUser with userId and tenantId but NOT email (GDPR/LGPD)', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/1';

      const sentry = await import('@sentry/nextjs');
      const { setUserContext } = await import('./error-tracker');
      setUserContext('user-1', 'user@example.com', 'tenant-1');

      const call = (sentry.setUser as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.id).toBe('user-1');
      // email must NOT be forwarded to Sentry — PII under GDPR/LGPD
      expect(call.email).toBeUndefined();
      expect(call.extra).toEqual({ tenantId: 'tenant-1' });

      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });

    it('omits extra entirely when tenantId is not provided', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/1';

      const sentry = await import('@sentry/nextjs');
      const { setUserContext } = await import('./error-tracker');
      setUserContext('user-2');

      expect(sentry.setUser).toHaveBeenCalledWith({ id: 'user-2' });

      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });

    it('is a no-op when DSN is not configured', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const sentry = await import('@sentry/nextjs');
      const { setUserContext } = await import('./error-tracker');
      setUserContext('user-1');

      expect(sentry.setUser).not.toHaveBeenCalled();

      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });
  });

  describe('clearUserContext', () => {
    it('calls Sentry.setUser(null) when DSN is set', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/1';

      const sentry = await import('@sentry/nextjs');
      const { clearUserContext } = await import('./error-tracker');
      clearUserContext();

      expect(sentry.setUser).toHaveBeenCalledWith(null);

      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });

    it('is a no-op when DSN is not configured', async () => {
      const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const sentry = await import('@sentry/nextjs');
      const { clearUserContext } = await import('./error-tracker');
      clearUserContext();

      expect(sentry.setUser).not.toHaveBeenCalled();

      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    });
  });

  describe('initErrorTracker', () => {
    it('is callable without throwing', async () => {
      const { initErrorTracker } = await import('./error-tracker');
      expect(() => initErrorTracker()).not.toThrow();
    });
  });
});
