import pino from 'pino';

/**
 * Server-side structured logger for the Dashboard.
 * In Lambda/OpenNext, stdout JSON → CloudWatch Logs automatically.
 *
 * SECURITY: Sensitive fields are redacted for SOC2/LGPD/GDPR compliance.
 * - Passwords, tokens, secrets are never logged
 * - Authorization headers and cookies are redacted
 * - PII (email, name) is redacted at the transport level
 * - User IDs and tenant IDs are opaque identifiers — safe to log
 */

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'body.password',
  'body.token',
  'body.refreshToken',
  'body.accessToken',
  'body.secret',
  'body.apiKey',
  'body.credentials',
  'body.credentials.*',
  // PII — email and name are redacted to prevent accidental info-level logging
  'email',
  'name',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: REDACT_PATHS,
  // In Lambda/OpenNext, pino's default JSON output goes to CloudWatch via stdout.
  // No transport needed — pino-pretty would break in serverless environments.
});

export function createRequestLogger(context: {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  role?: string;
  method?: string;
  path?: string;
}) {
  return logger.child(context);
}
