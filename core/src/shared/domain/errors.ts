export class AppError extends Error {
  code;
  statusCode;
  details;
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
  }
  toJSON(): Record<string, unknown> {
    return {
      error: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}
export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}
export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429, { retryAfterSeconds });
  }
}
export class QuotaExceededError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QUOTA_EXCEEDED', 429, details);
  }
}
export class PaymentRequiredError extends AppError {
  constructor(
    message: string,
    suggestion?: 'upgrade' | 'update_payment' | 'renew' | 'reactivate',
    details?: Record<string, unknown>,
  ) {
    super(message, 'CREDITS_EXHAUSTED', 402, { ...(suggestion && { suggestion }), ...details });
  }
}
/**
 * Thrown by POST /v1/admin/fire-test-errors to produce a real HTTP 500 that
 * Sentry's Hono auto-instrumentation captures. The global error handler shapes
 * the response as { error: 'TestErrorFired', traceId } per AD-7 / Sprint 04.
 */
export class TestErrorFiredError extends AppError {
  readonly traceId: string;
  constructor(name: string, traceId: string) {
    super(`Manual fire-test-error: ${name}`, 'TestErrorFired', 500);
    this.traceId = traceId;
  }
  override toJSON(): Record<string, unknown> {
    return {
      error: 'TestErrorFired',
      traceId: this.traceId,
    };
  }
}
