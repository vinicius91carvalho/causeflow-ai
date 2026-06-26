import { context, trace } from '@opentelemetry/api';
import type { Message } from '@aws-sdk/client-sqs';
import { withLogContext, getLogger, type LogContext } from '../logger/log-context.js';
import { extractTraceparent } from './propagation.js';

export interface RunJobOpts {
  jobType: string;
  queueName: string;
  tenantIdFromBody?: (body: unknown) => string | undefined;
}

export async function runJob<T>(
  msg: Message,
  handler: (parsedBody: unknown) => Promise<T>,
  opts: RunJobOpts,
): Promise<T> {
  const attrs = msg.MessageAttributes ?? {};
  const requestId = attrs['requestId']?.StringValue ?? `job-${msg.MessageId ?? 'unknown'}`;
  const parsedBody: unknown = msg.Body ? safeJson(msg.Body) : undefined;
  const tenantId = opts.tenantIdFromBody?.(parsedBody);
  const otelCtx = extractTraceparent(msg.MessageAttributes);

  return context.with(otelCtx, async () => {
    const traceId = trace.getSpanContext(otelCtx)?.traceId;
    const ctx: LogContext = {
      requestId,
      jobId: msg.MessageId,
      jobType: opts.jobType,
      queueName: opts.queueName,
      ...(tenantId ? { tenantId } : {}),
      ...(traceId ? { traceId } : {}),
    };

    return withLogContext(ctx, async () => {
      const start = Date.now();
      const log = getLogger();
      log.info({ event: 'job.received', jobType: opts.jobType, queueName: opts.queueName }, 'job.received');
      log.info({ event: 'job.started', jobType: opts.jobType }, 'job.started');
      try {
        const res = await handler(parsedBody);
        log.info(
          { event: 'job.completed', jobType: opts.jobType, durationMs: Date.now() - start, ok: true },
          'job.completed',
        );
        return res;
      } catch (err) {
        const e = err as Error;
        log.error(
          {
            event: 'job.failed',
            jobType: opts.jobType,
            durationMs: Date.now() - start,
            ok: false,
            errorType: e.name,
            message: String(e.message ?? '').slice(0, 200),
          },
          'job.failed',
        );
        throw err;
      }
    });
  });
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}
