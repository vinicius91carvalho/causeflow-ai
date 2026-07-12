import { Hono } from 'hono';
import { incidentId } from '../../../shared/domain/value-objects.js';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import { sanitizeIncidentForTenant } from '../../ingestion/domain/incident.entity.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { TriageIncidentUseCase } from '../application/triage-incident.usecase.js';
import type { IEvidenceRepository } from '../domain/evidence.repository.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';

export interface TriageUseCases {
  triageIncident: TriageIncidentUseCase;
  evidenceRepo: IEvidenceRepository;
  incidentRepo: IIncidentRepository;
}

export function createTriageRoutes(
  useCases: TriageUseCases,
): Hono<AppEnv, import('hono/types').BlankSchema, '/'> {
  const app = new Hono<AppEnv>();
  app.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const result = await useCases.incidentRepo.listByCreatedAt(tenantId, { limit: 50 });
    return c.json({ items: result.items.map(sanitizeIncidentForTenant) });
  });
  app.get('/:id', async (c) => {
    const tenantId = c.get('tenantId');
    const id = incidentId(c.req.param('id'));
    const incident = await useCases.incidentRepo.findById(tenantId, id);
    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }
    return c.json(sanitizeIncidentForTenant(incident));
  });
  app.get('/:incidentId/evidence', async (c) => {
    const tenantId = c.get('tenantId');
    const id = incidentId(c.req.param('incidentId'));
    const evidence = await useCases.evidenceRepo.findByIncident(tenantId, id);
    return c.json({ items: evidence });
  });
  app.post('/:incidentId', requireRole('admin'), async (c) => {
    const tenantId = c.get('tenantId');
    const id = incidentId(c.req.param('incidentId'));
    const result = await useCases.triageIncident.execute(tenantId, id);
    return c.json(result);
  });
  return app;
}
