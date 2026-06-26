import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;

/**
 * Initialize Sentry for the core backend.
 * No-op when SENTRY_DSN is not configured (local dev without Sentry).
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] SENTRY_DSN not set — Sentry disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.GIT_SHA ?? 'unknown',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Strip PII from request headers (GDPR/LGPD/SOC2)
      if (event.request?.headers) {
        const sensitiveHeaders = [
          'authorization',
          'cookie',
          'x-api-key',
          'x-clerk-auth-token',
          'x-session-token',
        ];
        for (const header of sensitiveHeaders) {
          if (event.request.headers[header]) {
            event.request.headers[header] = '[Filtered]';
          }
        }
      }
      // Strip request body and cookies
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      // Strip user PII
      if (event.user) {
        delete event.user.ip_address;
        delete event.user.email;
      }
      return event;
    },
  });
}

/**
 * Capture an exception with contextual scope.
 * Falls back to console.error when Sentry is not initialized.
 */
export function captureException(
  error: unknown,
  context?: {
    requestId?: string;
    tenantId?: string;
    userId?: string;
    method?: string;
    path?: string;
  },
): void {
  if (!SENTRY_DSN) {
    return; // Already logged via Pino in error-handler
  }

  Sentry.withScope((scope) => {
    if (context?.requestId) scope.setTag('requestId', context.requestId);
    if (context?.tenantId) scope.setTag('tenantId', context.tenantId);
    if (context?.userId) scope.setTag('userId', context.userId);
    if (context?.method) scope.setTag('http.method', context.method);
    if (context?.path) scope.setTag('http.path', context.path);
    Sentry.captureException(error);
  });
}

export { Sentry };
