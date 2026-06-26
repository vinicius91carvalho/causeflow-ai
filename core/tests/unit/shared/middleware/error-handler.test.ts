import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../../../src/shared/infra/http/middleware/error-handler.js';
import {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../../../../src/shared/domain/errors.js';

const mockLogger = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: mockLogger,
}));

function createApp(throwFn: () => never) {
  const app = new Hono();
  app.onError(errorHandler);
  app.get('/test-error', () => {
    throwFn();
  });
  return app;
}

describe('errorHandler', () => {
  it('returns correct statusCode and JSON for AppError', async () => {
    const app = createApp(() => {
      throw new AppError('test', 'TEST_ERROR', 422);
    });

    const res = await app.request('/test-error');
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: 'TEST_ERROR', message: 'test' });
  });

  it('returns 404 for NotFoundError', async () => {
    const app = createApp(() => {
      throw new NotFoundError('Resource', 'id-1');
    });

    const res = await app.request('/test-error');
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('NOT_FOUND');
    expect(body['message']).toContain('id-1');
  });

  it('returns 400 with details for ValidationError', async () => {
    const app = createApp(() => {
      throw new ValidationError('invalid', { field: 'name' });
    });

    const res = await app.request('/test-error');
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('VALIDATION_ERROR');
    expect(body['message']).toBe('invalid');
    expect(body['details']).toEqual({ field: 'name' });
  });

  it('returns 500 for generic Error', async () => {
    const app = createApp(() => {
      throw new Error('boom');
    });

    const res = await app.request('/test-error');
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });

  it('returns 409 for ConflictError', async () => {
    const app = createApp(() => {
      throw new ConflictError('duplicate');
    });

    const res = await app.request('/test-error');
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('CONFLICT');
    expect(body['message']).toBe('duplicate');
  });
});
