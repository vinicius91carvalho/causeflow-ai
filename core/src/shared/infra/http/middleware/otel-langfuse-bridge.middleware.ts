import { currentTraceId } from '../../observability/propagation.js';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../hono-types.js';

/**
 * Middleware that extracts the current OpenTelemetry trace ID from the
 * active span (set by auto-instrumentation at the start of every HTTP
 * request) and stashes it in the Hono context as `otelTraceId`.
 *
 * Route handlers and use cases can read `c.get('otelTraceId')` to pass
 * the correlation ID into Langfuse spans via `traceContext`, enabling
 * cross-database search: "find all Langfuse traces whose otelTraceId
 * matches this OTel trace ID".
 */
export function otelLangfuseBridge(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const traceId = currentTraceId();
    if (traceId) {
      c.set('otelTraceId', traceId);
    }
    await next();
  };
}
