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
 *
 * AC-042: redaction covers auth headers, Clerk session tokens, and Stripe
 * secrets (Stripe-specific field names + env-style keys) at every nesting
 * level reachable by pino's fast-redact (top-level, body.*, req.headers.*,
 * and single-segment wildcard variants).
 */

// Stripe-specific + env-style secret keys that must never leak to logs.
// Kept as a list so we can derive redact paths at multiple nesting levels.
const SECRET_KEYS = [
  'stripeSecretKey',
  'stripeToken',
  'stripePaymentMethodId',
  'stripePublishableKey',
  'clerkSecretKey',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
] as const;

/** Build redact paths for a secret key at every nesting level pino matches. */
function secretPaths(key: string): string[] {
  return [
    key, // top-level
    `*.${key}`, // one segment deep (e.g. body.stripeSecretKey)
    `body.${key}`,
    `body.*.${key}`, // body.credentials.stripeSecretKey, body.<x>.stripeSecretKey
    `req.headers.${key}`,
    `req.headers["${key}"]`,
  ];
}

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-clerk-auth-token"]',
  'req.headers["x-session-token"]',
  'body.password',
  'body.token',
  'body.refreshToken',
  'body.accessToken',
  'body.secret',
  'body.apiKey',
  'body.credentials',
  'body.credentials.*',
  // PII — email and name redacted at every nesting level fast-redact matches
  // (e.g. user.email, body.email) to match the depth applied to secrets below.
  ...['email', 'name'].flatMap(secretPaths),
  // AC-042: Stripe / Clerk secrets at every nesting level fast-redact matches.
  ...SECRET_KEYS.flatMap(secretPaths),
];

// Exported for tests (logger.test.ts) so the redact config can be exercised
// against a capturing destination without touching real stdout.
export const REDACT_PATHS_FOR_TESTS = REDACT_PATHS;

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
