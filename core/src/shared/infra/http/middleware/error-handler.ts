import { AppError } from '../../../domain/errors.js';
import { logger } from '../../logger.js';
import { captureException } from '../../observability/sentry.js';
import { isSilentPath } from '../../../config/log-paths.js';
import type { ErrorHandler } from 'hono';

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') ?? 'no-request-id';
  const tenantId = c.get('tenantId') ?? 'anonymous';
  const userId = c.get('userId') ?? 'anonymous';
  const method = c.req.method;
  const path = c.req.path;
  const errorContext = { requestId, tenantId, userId, method, path };

  if (err instanceof AppError) {
    const isNoisyBotProbe =
      (err.statusCode === 401 || err.statusCode === 403) && isSilentPath(path);
    const logFn =
      err.statusCode >= 500
        ? logger.error.bind(logger)
        : isNoisyBotProbe
          ? logger.debug.bind(logger)
          : logger.warn.bind(logger);
    logFn({ err: err.toJSON(), path, method, requestId, tenantId, userId }, 'Application error');
    if (err.statusCode >= 500) {
      void captureException(err, errorContext);
    }
    return c.json(
      err.toJSON(),
      err.statusCode as import('hono/utils/http-status').ContentfulStatusCode,
    );
  }
  logger.error(
    {
      error: {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'UnknownError',
        code: (err as any)?.code,
      },
      path,
      method,
      requestId,
      tenantId,
      userId,
    },
    'Unhandled error',
  );
  void captureException(err, errorContext);
  return c.json({ error: 'INTERNAL_ERROR', message: 'Internal server error' }, 500);
};
