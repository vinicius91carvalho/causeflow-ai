import { Hono } from 'hono';
import type { AppEnv } from '../../src/shared/infra/http/hono-types.js';
import { tenantId } from '../../src/shared/domain/value-objects.js';
import { errorHandler } from '../../src/shared/infra/http/middleware/error-handler.js';

// Mock the logger to avoid pino output in tests
// NOTE: This must be called BEFORE importing errorHandler if needed
// But since we import directly, the caller must vi.mock the logger first.

export interface TestContext {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
}

export function createTestApp<T>(
  routeFactory: (useCases: T) => Hono<AppEnv>,
  mockUseCases: T,
  ctx: TestContext = {},
): Hono {
  const app = new Hono();

  // Error handler
  app.onError(errorHandler);

  // Mock auth/tenant middleware — inject context
  app.use('*', async (c, next) => {
    const tid = ctx.tenantId ?? 'tenant-1';
    const cs = c as unknown as { set: (key: string, value: unknown) => void };
    cs.set('tenantId', tenantId(tid));
    cs.set('userId', ctx.userId ?? 'user-1');
    cs.set('userEmail', ctx.userEmail ?? 'admin@test.com');
    cs.set('userRoles', ctx.userRoles ?? ['admin', 'owner']);
    cs.set('requestId', 'test-request-id-001');
    return next();
  });

  // Mount routes
  app.route('/test', routeFactory(mockUseCases));

  return app;
}
