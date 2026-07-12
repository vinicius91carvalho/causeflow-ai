import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Scope } from '@sentry/node';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: Partial<Scope>) => void) =>
    cb({
      setTag: vi.fn(),
    }),
  ),
}));

describe('sentry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('initSentry', () => {
    it('calls Sentry.init when SENTRY_DSN is set', async () => {
      const original = process.env.SENTRY_DSN;
      process.env.SENTRY_DSN = 'https://test@sentry.io/1';

      const Sentry = await import('@sentry/node');
      const { initSentry } = await import('../../../../src/shared/infra/observability/sentry.js');
      await initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/1',
        }),
      );

      process.env.SENTRY_DSN = original;
    });

    it('does not call Sentry.init when SENTRY_DSN is not set', async () => {
      const original = process.env.SENTRY_DSN;
      delete process.env.SENTRY_DSN;

      // Force re-import to pick up cleared SENTRY_DSN env var
      vi.resetModules();
      const Sentry = await import('@sentry/node');
      const { initSentry } = await import('../../../../src/shared/infra/observability/sentry.js');
      await initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();

      process.env.SENTRY_DSN = original;
    });
  });

  describe('captureException', () => {
    it('calls Sentry.captureException with scope tags when DSN is set', async () => {
      const original = process.env.SENTRY_DSN;
      process.env.SENTRY_DSN = 'https://test@sentry.io/1';

      const Sentry = await import('@sentry/node');
      const setTagMock = vi.fn();
      (Sentry.withScope as ReturnType<typeof vi.fn>).mockImplementation(
        (cb: (scope: Partial<Scope>) => void) => cb({ setTag: setTagMock }),
      );

      const { captureException } =
        await import('../../../../src/shared/infra/observability/sentry.js');
      const err = new Error('boom');
      await captureException(err, {
        requestId: 'req-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        method: 'GET',
        path: '/api/test',
      });

      expect(setTagMock).toHaveBeenCalledWith('requestId', 'req-1');
      expect(setTagMock).toHaveBeenCalledWith('tenantId', 'tenant-1');
      expect(setTagMock).toHaveBeenCalledWith('userId', 'user-1');
      expect(setTagMock).toHaveBeenCalledWith('http.method', 'GET');
      expect(setTagMock).toHaveBeenCalledWith('http.path', '/api/test');
      expect(Sentry.captureException).toHaveBeenCalledWith(err);

      process.env.SENTRY_DSN = original;
    });

    it('does nothing when SENTRY_DSN is not set', async () => {
      const original = process.env.SENTRY_DSN;
      delete process.env.SENTRY_DSN;

      // Force re-import to pick up cleared SENTRY_DSN env var
      vi.resetModules();
      const Sentry = await import('@sentry/node');
      const { captureException } =
        await import('../../../../src/shared/infra/observability/sentry.js');
      await captureException(new Error('boom'));

      // With DSN empty, the dynamic import is skipped so withScope is never called
      expect(Sentry.withScope).not.toHaveBeenCalled();

      process.env.SENTRY_DSN = original;
    });
  });

  describe('beforeSend PII scrubbing', () => {
    it('strips sensitive headers, request data, cookies, and user PII', async () => {
      const original = process.env.SENTRY_DSN;
      process.env.SENTRY_DSN = 'https://test@sentry.io/1';

      const Sentry = await import('@sentry/node');
      const { initSentry } = await import('../../../../src/shared/infra/observability/sentry.js');
      await initSentry();

      const initCall = (Sentry.init as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
        beforeSend: (event: Record<string, unknown>) => Record<string, unknown>;
      };
      const beforeSend = initCall.beforeSend;

      const event = {
        request: {
          headers: {
            authorization: 'Bearer secret',
            cookie: 'session=abc',
            'x-api-key': 'key-123',
            'x-clerk-auth-token': 'clerk-token',
            'x-session-token': 'session-token',
            'content-type': 'application/json',
          },
          data: '{"password": "secret"}',
          cookies: { session: 'abc' },
        },
        user: {
          id: 'user-1',
          ip_address: '1.2.3.4',
          email: 'user@example.com',
        },
      };

      const result = beforeSend(event as unknown as Record<string, unknown>) as {
        request: {
          headers: Record<string, string>;
          data?: string;
          cookies?: Record<string, string>;
        };
        user: {
          id: string;
          ip_address?: string;
          email?: string;
        };
      };

      // Sensitive headers filtered
      expect(result.request.headers.authorization).toBe('[Filtered]');
      expect(result.request.headers.cookie).toBe('[Filtered]');
      expect(result.request.headers['x-api-key']).toBe('[Filtered]');
      expect(result.request.headers['x-clerk-auth-token']).toBe('[Filtered]');
      expect(result.request.headers['x-session-token']).toBe('[Filtered]');
      // Non-sensitive headers kept
      expect(result.request.headers['content-type']).toBe('application/json');
      // Body and cookies stripped
      expect(result.request.data).toBeUndefined();
      expect(result.request.cookies).toBeUndefined();
      // User PII stripped but id kept
      expect(result.user.id).toBe('user-1');
      expect(result.user.ip_address).toBeUndefined();
      expect(result.user.email).toBeUndefined();

      process.env.SENTRY_DSN = original;
    });
  });
});
