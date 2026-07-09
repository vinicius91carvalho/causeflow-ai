const SENTRY_DSN = process.env.SENTRY_DSN;

/**
 * Lazy reference to the Sentry SDK. Only populated when SENTRY_DSN is set.
 * This ensures @sentry/node is never loaded at module level when Sentry is
 * not configured (AC-049).
 */
let _Sentry: typeof import('@sentry/node') | null = null;

async function getSentry(): Promise<typeof import('@sentry/node') | null> {
  if (_Sentry !== null) return _Sentry;
  if (!SENTRY_DSN) return null;
  _Sentry = await import('@sentry/node');
  return _Sentry;
}

/**
 * Initialize Sentry for the core backend.
 * No-op when SENTRY_DSN is not configured (local dev without Sentry).
 * The @sentry/node module is NOT loaded at module level — it is imported
 * lazily only when this function is called and SENTRY_DSN is set (AC-049).
 */
export async function initSentry(): Promise<void> {
  const Sentry = await getSentry();
  if (!Sentry) {
    return; // Sentry not configured — silently skip (no console.warn in production)
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
 * Falls back to no-op when Sentry is not configured (SENTRY_DSN empty).
 * The @sentry/node module is NOT loaded at module level — it is imported
 * lazily only when SENTRY_DSN is set (AC-049).
 */
export async function captureException(
  error: unknown,
  context?: {
    requestId?: string;
    tenantId?: string;
    userId?: string;
    method?: string;
    path?: string;
  },
): Promise<void> {
  const Sentry = await getSentry();
  if (!Sentry) {
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
