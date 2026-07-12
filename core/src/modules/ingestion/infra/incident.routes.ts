import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { incidentId } from '../../../shared/domain/value-objects.js';
import { config } from '../../../shared/config/index.js';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import { isStaffEmail } from '../../../shared/infra/http/middleware/staff.middleware.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
import { sanitizeIncidentForTenant } from '../domain/incident.entity.js';
import type { GetIncidentUseCase } from '../application/get-incident.usecase.js';
import type { ListIncidentsUseCase } from '../application/list-incidents.usecase.js';
import type { UpdateIncidentStatusUseCase } from '../application/update-incident-status.usecase.js';
import type { UpdateIncidentSeverityUseCase } from '../application/update-incident-severity.usecase.js';
import type { CreateManualIncidentUseCase } from '../application/create-manual-incident.usecase.js';
import type { ReserveInvestigationUseCase } from '../../billing/application/reserve-investigation.usecase.js';

export interface IncidentUseCases {
  getIncident: GetIncidentUseCase;
  listIncidents: ListIncidentsUseCase;
  updateIncidentStatus: UpdateIncidentStatusUseCase;
  updateIncidentSeverity?: UpdateIncidentSeverityUseCase;
  createManualIncident: CreateManualIncidentUseCase;
  incidentRepo: IIncidentRepository;
  reserveInvestigation?: ReserveInvestigationUseCase;
}

const updateStatusSchema = z.object({
  status: z.enum([
    'open',
    'triaging',
    'investigating',
    'awaiting_approval',
    'remediating',
    'resolved',
    'closed',
  ]),
});
const createManualIncidentSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  suggestedAgents: z.array(z.string()).optional(),
  /**
   * Staff-only field. Server-side, the handler drops this unless the
   * caller's email ends with `@causeflow.ai`. Tenant admins can submit
   * it and it will be silently ignored — so there is no feedback loop
   * that exposes the experimental modes to tenants.
   */
  investigationMode: z.enum(['orchestrator', 'hypothesis', 'debate']).optional(),
});
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const VALID_STATUSES = [
  'open',
  'triaging',
  'investigating',
  'awaiting_approval',
  'remediating',
  'resolved',
  'closed',
  'aborted',
  'failed',
  'inconclusive',
];
export function createIncidentRoutes(
  useCases: IncidentUseCases,
): Hono<AppEnv, import('hono/types').BlankSchema, '/'> {
  const app = new Hono<AppEnv>();
  app.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const limit = Number(c.req.query('limit') ?? '20');
    const cursor = c.req.query('cursor');
    const severity = c.req.query('severity');
    const status = c.req.query('status');
    const sort = c.req.query('sort');
    function sanitizeList(result: { items: any[]; cursor?: string }) {
      return { items: result.items.map(sanitizeIncidentForTenant), cursor: result.cursor };
    }
    if (severity && VALID_SEVERITIES.includes(severity)) {
      if (status && VALID_STATUSES.includes(status)) {
        const result = await useCases.incidentRepo.findByStatus(
          tenantId,
          severity as any,
          status as any,
          { limit, cursor },
        );
        return c.json(sanitizeList(result));
      }
      const result = await useCases.incidentRepo.findBySeverity(tenantId, severity as any, {
        limit,
        cursor,
      });
      return c.json(sanitizeList(result));
    }
    {
      const order = sort === 'asc' ? 'asc' : 'desc';
      const result = await useCases.incidentRepo.listByCreatedAt(tenantId, {
        limit,
        cursor,
        order,
      });
      return c.json(sanitizeList(result));
    }
  });
  // Create a new incident (bare POST, no /chat suffix).
  // AC-040: authenticated request writes a row visible in Postgres.
  // AC-040: authenticated users with admin or member role can create incidents.
  app.post(
    '/',
    requireRole('admin', 'member'),
    zValidator('json', createManualIncidentSchema),
    async (c) => {
      const tenantId = c.get('tenantId');
      const body = c.req.valid('json');
      const userEmail = c.get('userEmail');
      const actorUserId = c.get('userId');
      const investigationMode = isStaffEmail(userEmail) ? body.investigationMode : undefined;
      const incident = await useCases.createManualIncident.execute({
        tenantId,
        title: body.title,
        description: body.description,
        severity: body.severity,
        suggestedAgents: body.suggestedAgents,
        createdBy: userEmail ?? 'unknown',
        actorUserId,
        actorEmail: userEmail,
        investigationMode,
      });
      return c.json(
        {
          incidentId: incident.incidentId,
          status: incident.status,
          message:
            incident.status === 'triaging'
              ? 'Incident created and queued for investigation'
              : 'Incident created and queued for triage',
        },
        201,
      );
    },
  );

  // Create incident via chat (must be before /:id to avoid path collision)
  app.post(
    '/chat',
    requireRole('admin'),
    zValidator('json', createManualIncidentSchema),
    async (c) => {
      const tenantId = c.get('tenantId');
      const body = c.req.valid('json');
      const userEmail = c.get('userEmail');
      // Reserve investigation credit (atomic increment with quota check)
      // Skip billing check in OSS runtime (Stripe is not used; AC-043).
      // The DynamoDB-backed BillingAccountRepository is not available in OSS.
      if (useCases.reserveInvestigation && !config.isOss()) {
        const reservation = await useCases.reserveInvestigation.execute(tenantId);
        if (!reservation.reserved) {
          return c.json({ error: 'QUOTA_EXCEEDED', message: 'Investigation limit reached' }, 402);
        }
      }
      const actorUserId = c.get('userId');
      // Staff-only: drop `investigationMode` unless caller is CauseFlow
      // staff. Tenant admins can submit it but it never takes effect
      // here — keeps the experimental modes invisible to tenants.
      const investigationMode = isStaffEmail(userEmail) ? body.investigationMode : undefined;
      const incident = await useCases.createManualIncident.execute({
        tenantId,
        title: body.title,
        description: body.description,
        severity: body.severity,
        suggestedAgents: body.suggestedAgents,
        createdBy: userEmail ?? 'unknown',
        actorUserId,
        actorEmail: userEmail,
        investigationMode,
      });
      return c.json(
        {
          incidentId: incident.incidentId,
          status: incident.status,
          message:
            incident.status === 'triaging'
              ? 'Incident created and queued for investigation'
              : 'Incident created and queued for triage',
        },
        201,
      );
    },
  );
  app.get('/:id', async (c) => {
    const tenantId = c.get('tenantId');
    const id = incidentId(c.req.param('id'));
    const incident = await useCases.getIncident.execute(tenantId, id);
    return c.json(sanitizeIncidentForTenant(incident));
  });
  app.patch('/:id', requireRole('admin'), zValidator('json', updateStatusSchema), async (c) => {
    const tenantId = c.get('tenantId');
    const id = incidentId(c.req.param('id'));
    const { status } = c.req.valid('json');
    const patchActorUserId = c.get('userId');
    const patchActorEmail = c.get('userEmail');
    const incident = await useCases.updateIncidentStatus.execute(
      tenantId,
      id,
      status,
      patchActorUserId,
      patchActorEmail,
    );
    return c.json(sanitizeIncidentForTenant(incident));
  });

  // PATCH /v1/incidents/:id/severity — update incident severity (AC-033)
  app.patch(
    '/:id/severity',
    requireRole('admin'),
    zValidator(
      'json',
      z.object({
        severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
      }),
    ),
    async (c) => {
      if (!useCases.updateIncidentSeverity) {
        return c.json({ error: 'Severity update not configured' }, 501);
      }
      const tenantId = c.get('tenantId');
      const id = incidentId(c.req.param('id'));
      const { severity } = c.req.valid('json');
      await useCases.updateIncidentSeverity.execute(tenantId, id, severity);
      return c.json({ ok: true });
    },
  );

  return app;
}
