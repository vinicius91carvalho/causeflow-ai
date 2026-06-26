import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorContext {
  /** User ID (from session) */
  userId?: string;
  /** Tenant ID */
  tenantId?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the error tracker.
 * No-op — Sentry initializes via sentry.client.config.ts / sentry.server.config.ts.
 * Kept for backward compatibility with call sites in the root layout.
 */
export function initErrorTracker(): void {
  // Sentry is initialized via instrumentation.ts (server/edge) and
  // sentry.client.config.ts (browser). Nothing to do here.
}

// ---------------------------------------------------------------------------
// Error capture
// ---------------------------------------------------------------------------

/**
 * Capture an exception and send to Sentry.
 * Falls back to console.error when NEXT_PUBLIC_SENTRY_DSN is not configured.
 */
export function captureException(error: unknown, context?: ErrorContext): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.error('[ErrorTracker] Exception captured:', error, context);
    return;
  }

  Sentry.captureException(error, { extra: context });
}

/**
 * Capture a message (non-exception) with severity level.
 * Falls back to console when NEXT_PUBLIC_SENTRY_DSN is not configured.
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext,
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const logFn =
      level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    logFn(`[ErrorTracker] ${message}`, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set the active user context for error reports.
 * Call after successful sign-in.
 */
// _email kept for call-site compatibility but NOT forwarded to Sentry (GDPR/LGPD PII)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setUserContext(userId: string, _email?: string, tenantId?: string): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.setUser({ id: userId, ...(tenantId && { extra: { tenantId } }) });
}

/**
 * Clear user context on sign-out.
 */
export function clearUserContext(): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.setUser(null);
}
