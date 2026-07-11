import { Hono } from 'hono';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ConnectStubIntegrationUseCase } from '../application/connect-stub-integration.usecase.js';
import type { ProbeStubIntegrationUseCase } from '../application/probe-stub-integration.usecase.js';
import type { IngestViaStubIntegrationUseCase } from '../application/ingest-via-stub-integration.usecase.js';

export interface StubIntegrationRouteDeps {
  connectStub: ConnectStubIntegrationUseCase;
  probeStub: ProbeStubIntegrationUseCase;
  ingestViaStub: IngestViaStubIntegrationUseCase;
}

/**
 * OSS stub connector routes (AC-056).
 * Mounted at /v1/integrations/stub — exercises the documented stub-upstream app.
 */
export function createStubIntegrationRoutes(deps: StubIntegrationRouteDeps) {
  const app = new Hono<AppEnv>();

  // POST /connect — register tenant connection against stub upstream
  app.post('/connect', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    const body = await c.req.json().catch(() => ({})) as {
      baseUrl?: string;
      coreBaseUrl?: string;
    };
    const result = await deps.connectStub.execute({
      tenantId: tenantId(String(tid)),
      connectedBy: String(c.get('userId') ?? 'unknown'),
      baseUrl: body.baseUrl,
      coreBaseUrl: body.coreBaseUrl,
    });
    return c.json(result, 201);
  });

  // POST /probe — hit stub upstream probe endpoint (observable in stub state)
  app.post('/probe', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    const result = await deps.probeStub.execute({ tenantId: tenantId(String(tid)) });
    return c.json(result);
  });

  // POST /ingest — trigger stub upstream to emit a signed webhook into Core ingest
  app.post('/ingest', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    const body = await c.req.json().catch(() => ({})) as {
      title?: string;
      description?: string;
      priority?: string;
    };
    const result = await deps.ingestViaStub.execute({
      tenantId: tenantId(String(tid)),
      title: body.title,
      description: body.description,
      priority: body.priority,
    });
    return c.json(result, 202);
  });

  return app;
}
