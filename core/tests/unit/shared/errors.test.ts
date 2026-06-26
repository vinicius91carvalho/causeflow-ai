import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  TestErrorFiredError,
} from '../../../src/shared/domain/errors.js';

describe('AppError hierarchy', () => {
  it('AppError serializes to JSON', () => {
    const err = new AppError('something failed', 'CUSTOM', 500, { extra: true });
    expect(err.toJSON()).toEqual({
      error: 'CUSTOM',
      message: 'something failed',
      details: { extra: true },
    });
  });

  it('NotFoundError has 404 status', () => {
    const err = new NotFoundError('Tenant', 'abc');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('abc');
  });

  it('ValidationError has 400 status', () => {
    const err = new ValidationError('invalid field');
    expect(err.statusCode).toBe(400);
  });

  it('ConflictError has 409 status', () => {
    const err = new ConflictError('duplicate');
    expect(err.statusCode).toBe(409);
  });

  it('UnauthorizedError has 401 status', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it('ForbiddenError has 403 status', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it('RateLimitError has 429 status', () => {
    const err = new RateLimitError(60);
    expect(err.statusCode).toBe(429);
    expect(err.details).toEqual({ retryAfterSeconds: 60 });
  });

  describe('TestErrorFiredError', () => {
    it('has statusCode 500', () => {
      const err = new TestErrorFiredError('fire-test-errors', 'trace-abc');
      expect(err.statusCode).toBe(500);
    });

    it('is an instance of AppError and Error', () => {
      const err = new TestErrorFiredError('fire-test-errors', 'trace-abc');
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    });

    it('toJSON returns exact contract shape { error, traceId } with no message field', () => {
      const err = new TestErrorFiredError('fire-test-errors', 'trace-xyz-123');
      expect(err.toJSON()).toEqual({ error: 'TestErrorFired', traceId: 'trace-xyz-123' });
    });

    it('traceId is stored and accessible', () => {
      const err = new TestErrorFiredError('fire-test-errors', 'req-id-999');
      expect(err.traceId).toBe('req-id-999');
    });
  });
});
