import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import { redriveDLQ } from '../../../shared/infra/queue/dlq-redriver.js';
import { config } from '../../../shared/config/index.js';
import { ValidationError, TestErrorFiredError } from '../../../shared/domain/errors.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { IngestAlertUseCase } from '../application/ingest-alert.usecase.js';

export interface AdminDeps {
    incidentRepo: IIncidentRepository;
    ingestAlert: IngestAlertUseCase;
}

const redriveSchema = z.object({
    queue: z.enum(['alerts', 'investigation', 'remediation']),
    limit: z.number().int().min(1).max(10).optional(),
});
const QUEUE_MAP = {
    alerts: { dlq: config.sqs.alertDlqUrl, target: config.sqs.alertQueueUrl },
    investigation: { dlq: config.sqs.investigationDlqUrl, target: config.sqs.investigationQueueUrl },
    remediation: { dlq: config.sqs.remediationDlqUrl, target: config.sqs.remediationQueueUrl },
};
export function createAdminRoutes(deps: AdminDeps): Hono<AppEnv, import("hono/types").BlankSchema, "/"> {
    const app = new Hono<AppEnv>();
    app.post('/queues/redrive', requireRole('admin'), zValidator('json', redriveSchema), async (c) => {
        const { queue, limit } = c.req.valid('json');
        const urls = QUEUE_MAP[queue];
        if (!urls?.dlq || !urls?.target) {
            throw new ValidationError(`Queue URLs not configured for: ${queue}`);
        }
        const result = await redriveDLQ(urls.dlq, urls.target, limit ?? 10);
        return c.json(result);
    });
    app.post('/fire-test-errors', requireRole('admin'), async (c) => {
        if (config.stage === 'production') {
            return c.json({ error: 'Not available in production' }, 403);
        }
        const traceId = c.get('requestId') ?? 'no-request-id';
        // Throw a real Error so Sentry's Hono auto-instrumentation captures it (AD-7).
        // The global error handler catches TestErrorFiredError and returns:
        //   HTTP 500 { error: 'TestErrorFired', traceId }
        throw new TestErrorFiredError('fire-test-errors', traceId);
    });

    app.get('/costs', requireRole('admin'), async (c) => {
        const incidents = await deps.incidentRepo.findAll(c.get('tenantId'));
        let totalCostUsd = 0;
        let investigatedCount = 0;
        const costByIncident = [];
        for (const incident of incidents) {
            if (incident.totalCostUsd != null) {
                totalCostUsd += incident.totalCostUsd;
                investigatedCount++;
                costByIncident.push({
                    incidentId: incident.incidentId,
                    title: incident.title,
                    severity: incident.severity,
                    totalCostUsd: incident.totalCostUsd,
                    costBreakdown: incident.costBreakdown,
                    investigationDurationMs: incident.investigationDurationMs,
                    createdAt: incident.createdAt,
                });
            }
        }
        return c.json({
            totalCostUsd,
            avgCostPerInvestigation: investigatedCount > 0 ? totalCostUsd / investigatedCount : null,
            incidentCount: investigatedCount,
            costByIncident,
        });
    });
    return app;
}
