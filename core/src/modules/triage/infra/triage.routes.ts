import { Hono } from 'hono';
import { incidentId } from '../../../shared/domain/value-objects.js';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { TriageIncidentUseCase } from '../application/triage-incident.usecase.js';
import type { IEvidenceRepository } from '../domain/evidence.repository.js';

export interface TriageUseCases {
    triageIncident: TriageIncidentUseCase;
    evidenceRepo: IEvidenceRepository;
}

export function createTriageRoutes(useCases: TriageUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/"> {
    const app = new Hono<AppEnv>();
    app.post('/:incidentId', requireRole('admin'), async (c) => {
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const result = await useCases.triageIncident.execute(tenantId, id);
        return c.json(result);
    });
    app.get('/:incidentId/evidence', async (c) => {
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const evidence = await useCases.evidenceRepo.findByIncident(tenantId, id);
        return c.json({ items: evidence });
    });
    return app;
}
