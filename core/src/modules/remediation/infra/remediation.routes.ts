import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { remediationId, incidentId } from '../../../shared/domain/value-objects.js';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ProposeRemediationUseCase } from '../application/propose-remediation.usecase.js';
import type { ApproveRemediationUseCase } from '../application/approve-remediation.usecase.js';
import type { RejectRemediationUseCase } from '../application/reject-remediation.usecase.js';
import type { ExecuteRemediationUseCase } from '../application/execute-remediation.usecase.js';
import type { RollbackRemediationUseCase } from '../application/rollback-remediation.usecase.js';
import type { GetRemediationUseCase } from '../application/get-remediation.usecase.js';
import type { RecordRemediationFeedbackUseCase } from '../application/record-remediation-feedback.usecase.js';

export interface RemediationUseCases {
    proposeRemediation: ProposeRemediationUseCase;
    approveRemediation: ApproveRemediationUseCase;
    rejectRemediation: RejectRemediationUseCase;
    executeRemediation: ExecuteRemediationUseCase;
    rollbackRemediation: RollbackRemediationUseCase;
    getRemediation: GetRemediationUseCase;
    recordRemediationFeedback?: RecordRemediationFeedbackUseCase;
}

const proposeSchema = z.object({
    incidentId: z.string().min(1),
    rootCause: z.string().min(1),
    recommendedActions: z.array(z.object({
        action: z.string(),
        label: z.string().default(''),
        description: z.string().default(''),
        rationale: z.string().default(''),
        riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
        estimatedDuration: z.string().default(''),
        automated: z.boolean().default(false),
        params: z.record(z.unknown()).default({}),
    })).min(1),
});
const rejectSchema = z.object({
    reason: z.string().optional(),
});
const remediationFeedbackSchema = z.object({
    incidentId: z.string().min(1),
    type: z.enum(['remediation_effective', 'remediation_ineffective', 'remediation_made_worse']),
    freeText: z.string().optional(),
});
export function createRemediationRoutes(useCases: RemediationUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/"> {
    const app = new Hono<AppEnv>();
    // Propose remediation manually
    app.post('/', requireRole('admin'), zValidator('json', proposeSchema), async (c) => {
        const tid = c.get('tenantId');
        const body = c.req.valid('json');
        const actorUserId = c.get('userId');
        const actorEmail = c.get('userEmail');
        const remediation = await useCases.proposeRemediation.execute({
            tenantId: tid,
            incidentId: incidentId(body.incidentId),
            rootCause: body.rootCause,
            recommendedActions: body.recommendedActions,
            actorUserId,
            actorEmail,
        });
        return c.json(remediation, 201);
    });
    // List remediations by incident
    app.get('/:incidentId', async (c) => {
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const remediations = await useCases.getRemediation.listByIncident(tenantId, id);
        return c.json(remediations);
    });
    // Get remediation detail
    app.get('/detail/:remediationId', async (c) => {
        const tenantId = c.get('tenantId');
        const id = remediationId(c.req.param('remediationId'));
        const remediation = await useCases.getRemediation.getById(tenantId, id);
        return c.json(remediation);
    });
    // Get remediation proposal (AC-023) — returns the plan with AWS actions
    app.get('/:remediationId/proposal', async (c) => {
        const tenantId = c.get('tenantId');
        const id = remediationId(c.req.param('remediationId'));
        const remediation = await useCases.getRemediation.getById(tenantId, id);
        return c.json({
            remediationId: remediation.remediationId,
            incidentId: remediation.incidentId,
            status: remediation.status,
            rootCause: remediation.rootCause,
            description: remediation.description,
            steps: remediation.steps,
            proposedBy: remediation.proposedBy,
            createdAt: remediation.createdAt,
            updatedAt: remediation.updatedAt,
        });
    });
    // Approve remediation
    app.post('/:remediationId/approve', requireRole('admin'), async (c) => {
        const tenantId = c.get('tenantId');
        const id = remediationId(c.req.param('remediationId'));
        const approvedBy = c.get('userEmail');
        const otelTraceId = c.get('otelTraceId');
        const remediation = await useCases.approveRemediation.execute({
            tenantId,
            remediationId: id,
            approvedBy,
        });
        // OTel-Langfuse bridge: expose the correlation ID on the response
        const headers: Record<string, string> = {};
        if (otelTraceId) {
            headers['x-causeflow-trace-id'] = otelTraceId;
        }
        return c.json(remediation, 200, headers);
    });
    // Reject remediation
    app.post('/:remediationId/reject', requireRole('admin'), zValidator('json', rejectSchema), async (c) => {
        const tenantId = c.get('tenantId');
        const id = remediationId(c.req.param('remediationId'));
        const rejectedBy = c.get('userEmail');
        const { reason } = c.req.valid('json');
        const remediation = await useCases.rejectRemediation.execute({
            tenantId,
            remediationId: id,
            rejectedBy,
            reason,
        });
        return c.json(remediation);
    });
    // Execute remediation
    app.post('/:remediationId/execute', requireRole('admin'), async (c) => {
        const tenantId = c.get('tenantId');
        const id = remediationId(c.req.param('remediationId'));
        const actorUserId = c.get('userId');
        const actorEmail = c.get('userEmail');
        const remediation = await useCases.executeRemediation.execute({
            tenantId,
            remediationId: id,
            actorUserId,
            actorEmail,
        });
        return c.json(remediation);
    });
    // Rollback remediation
    app.post('/:remediationId/rollback', requireRole('admin'), async (c) => {
        const tenantId = c.get('tenantId');
        const id = remediationId(c.req.param('remediationId'));
        const actorEmail = c.get('userEmail');
        const remediation = await useCases.rollbackRemediation.execute({
            tenantId,
            remediationId: id,
            actorEmail,
        });
        return c.json(remediation, 201);
    });
    // Record remediation feedback
    app.post('/:remediationId/feedback', zValidator('json', remediationFeedbackSchema), async (c) => {
        if (!useCases.recordRemediationFeedback) {
            return c.json({ error: 'Remediation feedback not available' }, 501);
        }
        const tenantId = c.get('tenantId');
        const id = remediationId(c.req.param('remediationId'));
        const body = c.req.valid('json');
        const userEmail = c.get('userEmail');
        const result = await useCases.recordRemediationFeedback.execute({
            tenantId,
            remediationId: id,
            incidentId: body.incidentId,
            type: body.type,
            actor: userEmail ?? 'unknown',
            freeText: body.freeText,
        });
        return c.json(result, 201);
    });
    return app;
}
