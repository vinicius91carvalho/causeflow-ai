import { createMiddleware } from 'hono/factory';
import { isSensitivePath, isSilentPath } from '../../../../shared/config/log-paths.js';
import { getLogger, withLogContext } from '../../logger/log-context.js';
import type { AppEnv } from '../hono-types.js';

const MAX_USER_AGENT_LENGTH = 200;
const MAX_BODY_LOG_BYTES = 4096;

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 500);
  }
}

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

export const requestLoggerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get('requestId');
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const rawUserAgent = c.req.header('user-agent') ?? '';
  const userAgent =
    rawUserAgent.length > MAX_USER_AGENT_LENGTH
      ? rawUserAgent.slice(0, MAX_USER_AGENT_LENGTH)
      : rawUserAgent;

  // F-04: IP address is logged under legitimate interest (GDPR Art. 6(1)(f), LGPD Art. 7(IX))
  // for security monitoring and abuse prevention. Only the first (client) IP is retained;
  // the full proxy chain is discarded to minimise data collection.
  // For sensitive paths (auth/webhooks/oauth), clientIp is omitted entirely — absence is
  // safer than a redaction marker.
  const rawIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const sensitive = isSensitivePath(path);
  const silent = isSilentPath(path);

  const logCtx = {
    requestId: requestId ?? '',
    ...(tenantId !== undefined ? { tenantId } : {}),
    ...(userId !== undefined ? { actorUserId: userId } : {}),
    userAgent,
    ...(!sensitive ? { clientIp: rawIp } : {}),
  };

  await withLogContext(logCtx, async () => {
    const log = getLogger();

    // Log request body at info level for mutating requests (non-sensitive paths only)
    if (!sensitive && BODY_METHODS.has(method)) {
      const bodyText = await c.req.raw
        .clone()
        .text()
        .catch(() => '');
      if (bodyText) {
        log.info(
          { reqBody: tryParseJson(bodyText.slice(0, MAX_BODY_LOG_BYTES)) },
          'http.request.body',
        );
      }
    }

    // Log query params at info level for non-silent, non-sensitive requests
    if (!sensitive && !silent) {
      const raw = c.req.raw.url;
      const qIdx = raw.indexOf('?');
      if (qIdx !== -1) {
        const params = Object.fromEntries(new URLSearchParams(raw.slice(qIdx + 1)));
        if ('code' in params) params['code'] = '[REDACTED]';
        log.info({ query: params }, 'http.request.query');
      }
    }

    if (silent) {
      log.trace({ method, path }, 'http.request.started');
    } else {
      log.info({ method, path }, 'http.request.started');
    }

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;
    const userRoles = c.get('userRoles') ?? [];
    const contentLength = c.res.headers.get('content-length') ?? undefined;

    const msg = `${method} ${path} ${status} ${duration}ms`;

    const completedData = {
      method,
      path,
      status,
      duration,
      userRoles,
      contentLength,
    };

    // Log response body at info level for all non-sensitive, non-silent paths
    const contentType = c.res.headers.get('content-type') ?? '';
    if (!sensitive && !silent && !contentType.includes('text/event-stream')) {
      const resText = await c.res
        .clone()
        .text()
        .catch(() => '');
      if (resText) {
        log.info(
          { resBody: tryParseJson(resText.slice(0, MAX_BODY_LOG_BYTES)), status },
          'http.response.body',
        );
      }
    }

    if (status >= 500) {
      log.error(completedData, msg);
    } else if (status >= 400) {
      log.warn(completedData, msg);
    } else if (silent) {
      log.trace(completedData, msg);
    } else {
      log.info(completedData, msg);
    }
  });
});
