/**
 * Request Logger — CauseFlow AI Dashboard
 *
 * Structured request logging for API routes using pino.
 * In Lambda + OpenNext context, JSON stdout goes to CloudWatch Logs.
 *
 * SECURITY (SOC2 / LGPD / GDPR):
 * - User-agent is truncated to 200 chars max
 * - Only the first IP from x-forwarded-for is logged (client IP, not proxy chain)
 * - PII fields (email, name) are handled by the root logger's redact config
 * - userId and tenantId are opaque identifiers — safe to log
 *
 * Usage in API route handlers wrapped by withAuth():
 *   The withAuth() HOC calls logRequest() automatically. You do NOT need to
 *   call it manually in most route handlers.
 *
 *   For unauthenticated routes or manual control:
 *   import { logRequest } from '@/contexts/shared/lib/monitoring/request-logger';
 *   logRequest(request, response.status, durationMs, { userId, tenantId, role });
 */
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_USER_AGENT_LENGTH = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestLogContext {
  userId?: string;
  tenantId?: string;
  role?: string;
  // F-10: requestId added for correlation across distributed traces
  requestId?: string;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Log an API request with method, path, status, duration, and user context.
 * Log level is determined by HTTP status: 5xx → error, 4xx → warn, 2xx/3xx → info.
 */
export function logRequest(
  request: Request,
  status: number,
  durationMs: number,
  context?: RequestLogContext,
): void {
  const url = new URL(request.url);
  const rawUserAgent = request.headers.get('user-agent') ?? '';
  const userAgent =
    rawUserAgent.length > MAX_USER_AGENT_LENGTH
      ? rawUserAgent.slice(0, MAX_USER_AGENT_LENGTH)
      : rawUserAgent;
  // Log only the first (client) IP — never the full proxy chain
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const logData = {
    type: 'request' as const,
    method: request.method,
    path: url.pathname,
    status,
    durationMs,
    requestId: context?.requestId,
    userId: context?.userId ?? 'anonymous',
    tenantId: context?.tenantId ?? 'anonymous',
    role: context?.role ?? 'unknown',
    userAgent,
    ip,
  };

  const msg = `${request.method} ${url.pathname} ${status} ${durationMs}ms`;

  if (status >= 500) {
    logger.error(logData, msg);
  } else if (status >= 400) {
    logger.warn(logData, msg);
  } else {
    logger.info(logData, msg);
  }
}

/**
 * Log a slow request warning when duration exceeds threshold.
 * @param thresholdMs - Duration threshold in milliseconds (default: 3000ms)
 * @param context - Optional user context for correlation (F-11)
 */
export function logSlowRequest(
  method: string,
  path: string,
  durationMs: number,
  thresholdMs = 3000,
  context?: RequestLogContext,
): void {
  if (durationMs < thresholdMs) return;
  logger.warn(
    {
      type: 'slow_request',
      method,
      path,
      durationMs,
      thresholdMs,
      requestId: context?.requestId,
      userId: context?.userId,
      tenantId: context?.tenantId,
      role: context?.role,
    },
    `Slow request: ${method} ${path} ${durationMs}ms`,
  );
}
