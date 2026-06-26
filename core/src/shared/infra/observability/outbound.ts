import { trace, SpanStatusCode } from '@opentelemetry/api';
import { getLogger } from '../logger/log-context.js';

const tracer = trace.getTracer('causeflow');

export const ALLOWED_ATTR_KEYS = new Set([
  'model', 'inputTokens', 'outputTokens', 'itemCount',
  'tableName', 'operation', 'queueName', 'cacheHit',
  'durationMs', 'ok', 'statusCode', 'errorType',
]);

function filterAttributes(attrs?: Record<string, unknown>): Record<string, string | number | boolean> {
  if (!attrs) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (!ALLOWED_ATTR_KEYS.has(k)) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

export async function instrumentedCall<T>(
  target: string,
  op: string,
  fn: () => Promise<T>,
  opts?: {
    attributes?: Record<string, unknown>;
    logSuccessLevel?: 'info' | 'debug' | 'trace' | ((result: T) => 'info' | 'debug' | 'trace');
  },
): Promise<T> {
  const start = Date.now();
  const safeAttrs = filterAttributes(opts?.attributes);
  return tracer.startActiveSpan(`${target}.${op}`, async (span) => {
    for (const [k, v] of Object.entries(safeAttrs)) span.setAttribute(k, v);
    try {
      const res = await fn();
      const durationMs = Date.now() - start;
      span.setAttribute('durationMs', durationMs);
      span.setAttribute('ok', true);
      span.setStatus({ code: SpanStatusCode.OK });
      const successLevel = typeof opts?.logSuccessLevel === 'function'
        ? opts.logSuccessLevel(res)
        : (opts?.logSuccessLevel ?? 'info');
      getLogger()[successLevel]({ target, op, durationMs, ok: true, ...safeAttrs }, `${target}.${op} ok`);
      return res;
    } catch (err) {
      const e = err as Error & { statusCode?: number; $metadata?: { httpStatusCode?: number } };
      const durationMs = Date.now() - start;
      const statusCode = e.statusCode ?? e.$metadata?.httpStatusCode;
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.name });
      getLogger().error(
        {
          target, op, durationMs, ok: false,
          errorType: e.name,
          message: String(e.message ?? '').slice(0, 200),
          ...(statusCode !== undefined ? { statusCode } : {}),
        },
        `${target}.${op} failed`,
      );
      throw err;
    } finally {
      span.end();
    }
  });
}
