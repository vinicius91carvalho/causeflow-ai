import pino from 'pino';
import { config } from '../config/index.js';

export type Logger = typeof rootLogger;

const REDACT_PATHS = [
    // Headers
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
    // F-03: Clerk session/auth headers that may carry bearer tokens
    'req.headers["x-clerk-auth-token"]',
    'req.headers["x-session-token"]',
    // Request body fields (used by route handlers via c.req.json())
    'body.password',
    'body.currentPassword',
    'body.newPassword',
    'body.token',
    'body.refreshToken',
    'body.accessToken',
    'body.otp',
    'body.otpCode',
    'body.secret',
    'body.clientSecret',
    'body.apiKey',
    'body.credentials',
    'body.credentials.*',
    // Encryption fields
    'body.encryptedDek',
    'body.ciphertext',
    // reqBody.* / resBody.* — logged by request-logger middleware at debug level
    'reqBody.password',
    'reqBody.currentPassword',
    'reqBody.newPassword',
    'reqBody.token',
    'reqBody.refreshToken',
    'reqBody.accessToken',
    'reqBody.otp',
    'reqBody.otpCode',
    'reqBody.secret',
    'reqBody.clientSecret',
    'reqBody.apiKey',
    'reqBody.apiSecret',
    'reqBody.credentials',
    'reqBody.credentials.*',
    'reqBody.*.password',
    'reqBody.*.token',
    'reqBody.*.secret',
    'reqBody.*.apiKey',
    'reqBody.*.credentials',
    'reqBody.*.credentials.*',
    'reqBody.encryptedDek',
    'reqBody.ciphertext',
    'reqBody.email',
    'reqBody.phone',
    'resBody.token',
    'resBody.accessToken',
    'resBody.refreshToken',
    'resBody.apiKey',
    'resBody.secret',
    'resBody.plaintext',
    'resBody.webhookSecret',
    'resBody.credentials',
    'resBody.credentials.*',
    'resBody.encryptedDek',
    'resBody.ciphertext',
    // query string params — e.g. ?clientSecret=... (should never happen but guarded)
    'query.clientSecret',
    // catch-all: any nested object with a clientSecret field
    '*.clientSecret',
    // F-01: flat-object PII — catches callers who do logger.info({ email }, 'msg')
    // without nesting under body.*
    'email',
    'phone',
    'password',
    'token',
    'apiKey',
    'secret',
];

export const rootLogger = pino({
    level: config.logLevel,
    redact: REDACT_PATHS,
    transport: config.isDev()
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});

/** @deprecated Use `rootLogger` directly or `getLogger()` from log-context for request-scoped child. */
export const logger = rootLogger;

export function createRequestLogger(context: {
    requestId?: string;
    tenantId?: string;
    userId?: string;
    role?: string;
    method?: string;
    path?: string;
}) {
    return rootLogger.child(context);
}
