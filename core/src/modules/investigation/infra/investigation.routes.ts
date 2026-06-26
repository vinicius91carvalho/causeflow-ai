import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { incidentId } from '../../../shared/domain/value-objects.js';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import { requireStaff } from '../../../shared/infra/http/middleware/staff.middleware.js';
import { INVESTIGATION_MODE_NAMES } from '../application/modes/types.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import { sanitizeIncidentForTenant } from '../../ingestion/domain/incident.entity.js';
import type { DispatchInvestigationUseCase } from '../application/dispatch-investigation.usecase.js';
import type { GetInvestigationUseCase } from '../application/get-investigation.usecase.js';
import type { AddInvestigationContextUseCase } from '../application/add-investigation-context.usecase.js';
import type { RespondKnownSolutionUseCase } from '../application/respond-known-solution.usecase.js';
import type { RecordInvestigationFeedbackUseCase } from '../application/record-investigation-feedback.usecase.js';
import type { AbortInvestigationUseCase } from '../application/abort-investigation.usecase.js';
import type { ChatInvestigationUseCase } from '../application/chat-investigation.usecase.js';
import type { ListHypothesesUseCase } from '../application/list-hypotheses.usecase.js';
import type { IEvidenceRepository } from '../../triage/domain/evidence.repository.js';
import type { IToolCallRepository } from '../../triage/domain/tool-call.repository.js';
import { toolCallId as toToolCallId } from '../../../shared/domain/value-objects.js';

export interface InvestigationUseCases {
    /**
     * Dispatcher — routes to the mode stamped on the Incident
     * (orchestrator | hypothesis | debate). Callers treat it as a drop-in
     * replacement for the legacy InvestigateIncidentUseCase.
     */
    investigateIncident: DispatchInvestigationUseCase;
    getInvestigation: GetInvestigationUseCase;
    addInvestigationContext: AddInvestigationContextUseCase;
    respondKnownSolution?: RespondKnownSolutionUseCase;
    recordInvestigationFeedback?: RecordInvestigationFeedbackUseCase;
    abortInvestigation?: AbortInvestigationUseCase;
    chatInvestigation?: ChatInvestigationUseCase;
    /**
     * Lists hypotheses for an incident. Populated only when hypothesis
     * or debate modes have run — returns [] for orchestrator mode.
     */
    listHypotheses?: ListHypothesesUseCase;
    evidenceRepo: IEvidenceRepository;
    /**
     * Raw tool-call log (per-incident). Backs the drill-down endpoint so the
     * dashboard can show the exact input/output that produced a cited evidence.
     */
    toolCallRepo?: IToolCallRepository;
    /**
     * Repository handle for the admin mode-switch endpoint. Optional so older
     * composition roots stay valid, but admin/:id routes return 501 when
     * missing.
     */
    incidentRepo?: IIncidentRepository;
}

const addContextSchema = z.object({
    context: z.string().min(5),
    reinvestigate: z.boolean().optional(),
    suggestedAgents: z.array(z.string()).optional(),
});
const knownSolutionResponseSchema = z.object({
    response: z.enum(['accepted', 'declined']),
});
const investigationFeedbackSchema = z.object({
    type: z.enum(['investigation_accurate', 'investigation_inaccurate', 'investigation_partial']),
    freeText: z.string().optional(),
    agentFeedback: z.array(z.object({
        agentRole: z.string(),
        quality: z.number().min(1).max(5),
    })).optional(),
});
export function createInvestigationRoutes(useCases: InvestigationUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/"> {
    const app = new Hono<AppEnv>();
    // Add context to an existing investigation
    app.post('/:incidentId/context', requireRole('admin'), zValidator('json', addContextSchema), async (c) => {
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const body = c.req.valid('json');
        const userEmail = c.get('userEmail');
        const result = await useCases.addInvestigationContext.execute({
            tenantId,
            incidentId: id,
            context: body.context,
            addedBy: userEmail ?? 'unknown',
            reinvestigate: body.reinvestigate,
            suggestedAgents: body.suggestedAgents,
        });
        return c.json(result);
    });
    // Trigger investigation manually
    app.post('/:incidentId', requireRole('admin'), async (c) => {
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const result = await useCases.investigateIncident.execute({
            tenantId,
            incidentId: id,
            suggestedAgents: ['log_analyst', 'metric_analyst', 'infra_inspector'],
        });
        return c.json(result);
    });
    // Staff-only: stamp the investigation mode (and optional shadow mode)
    // on an existing incident and re-run the investigation under that mode.
    // Never exposed to tenant admins — only callers from @causeflow.ai emails.
    const adminRunSchema = z.object({
        mode: z.enum(INVESTIGATION_MODE_NAMES),
        shadowMode: z.enum(INVESTIGATION_MODE_NAMES).optional(),
        suggestedAgents: z.array(z.string()).optional(),
    });
    app.post('/admin/:incidentId/run', requireStaff, zValidator('json', adminRunSchema), async (c) => {
        if (!useCases.incidentRepo) {
            return c.json({ error: 'Admin run endpoint not wired (incidentRepo missing)' }, 501);
        }
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const body = c.req.valid('json');
        const patch: Record<string, unknown> = { investigationMode: body.mode };
        if (body.shadowMode !== undefined) {
            patch['shadowInvestigationMode'] = body.shadowMode;
        }
        await useCases.incidentRepo.update(tenantId, id, patch);
        const result = await useCases.investigateIncident.execute({
            tenantId,
            incidentId: id,
            suggestedAgents: body.suggestedAgents ?? [
                'log_analyst',
                'metric_analyst',
                'infra_inspector',
            ],
        });
        return c.json({ mode: body.mode, shadowMode: body.shadowMode, result });
    });
    // Respond to known solution suggestion
    app.post('/:incidentId/known-solution-response', requireRole('admin'), zValidator('json', knownSolutionResponseSchema), async (c) => {
        if (!useCases.respondKnownSolution) {
            return c.json({ error: 'Known solution response not available' }, 501);
        }
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const body = c.req.valid('json');
        const userEmail = c.get('userEmail');
        const result = await useCases.respondKnownSolution.execute({
            tenantId,
            incidentId: id,
            response: body.response,
            actor: userEmail ?? 'unknown',
        });
        return c.json(result);
    });
    // List investigation feedback
    app.get('/:incidentId/feedback', async (c) => {
        if (!useCases.recordInvestigationFeedback) {
            return c.json({ error: 'Investigation feedback not available' }, 501);
        }
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const feedback = await useCases.recordInvestigationFeedback.listByIncident(tenantId, id);
        return c.json({ feedback });
    });
    // Record investigation feedback
    app.post('/:incidentId/feedback', zValidator('json', investigationFeedbackSchema), async (c) => {
        if (!useCases.recordInvestigationFeedback) {
            return c.json({ error: 'Investigation feedback not available' }, 501);
        }
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const body = c.req.valid('json');
        const userEmail = c.get('userEmail');
        const result = await useCases.recordInvestigationFeedback.execute({
            tenantId,
            incidentId: id,
            type: body.type,
            actor: userEmail ?? 'unknown',
            freeText: body.freeText,
            agentFeedback: body.agentFeedback,
        });
        return c.json(result, 201);
    });
    // Abort a running investigation
    app.post('/:incidentId/abort', requireRole('admin'), async (c) => {
        if (!useCases.abortInvestigation) {
            return c.json({ error: 'Abort investigation not available' }, 501);
        }
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const userEmail = c.get('userEmail');
        const result = await useCases.abortInvestigation.execute(tenantId, id, userEmail ?? 'unknown');
        return c.json({ ...result, message: 'Investigation aborted' });
    });
    // Chat with investigation (REST fallback when no WebSocket worker is alive)
    const chatMessageSchema = z.object({ message: z.string().min(1) });
    app.post('/:incidentId/chat', zValidator('json', chatMessageSchema), async (c) => {
        if (!useCases.chatInvestigation) {
            return c.json({ error: 'Investigation chat not available' }, 501);
        }
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const body = c.req.valid('json');
        const result = await useCases.chatInvestigation.execute({
            tenantId, incidentId: id, message: body.message,
        });
        return c.json(result);
    });
    app.get('/:incidentId/chat', async (c) => {
        if (!useCases.chatInvestigation) {
            return c.json({ messages: [] });
        }
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const messages = await useCases.chatInvestigation.getHistory(tenantId, id);
        return c.json({ messages });
    });
    // Get relay token + WS URL for WebSocket connection (dashboard → investigation relay)
    app.get('/:incidentId/relay-token', async (c) => {
        const tenantId = c.get('tenantId');
        const id = c.req.param('incidentId');
        const { createRelayToken } = await import('../../../shared/infra/relay/investigation-relay-auth.js');
        const token = await createRelayToken({ tenantId, incidentId: id, role: 'dashboard' });
        const relayUrl = process.env['INVESTIGATION_RELAY_URL'] ?? '';
        return c.json({ token, relayUrl, expiresIn: 900 });
    });
    // Get investigation result + evidence by agent
    app.get('/:incidentId', async (c) => {
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const detail = await useCases.getInvestigation.execute(tenantId, id);
        return c.json({
            ...detail,
            incident: sanitizeIncidentForTenant(detail.incident),
        });
    });
    // Get a single raw tool call (input + output) — drill-down for cited evidence.
    app.get('/:incidentId/tool-calls/:toolCallId', async (c) => {
        if (!useCases.toolCallRepo) {
            return c.json({ error: 'tool-call audit log not available' }, 501);
        }
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const tcId = toToolCallId(c.req.param('toolCallId'));
        const record = await useCases.toolCallRepo.findById(tenantId, id, tcId);
        if (!record) {
            return c.json({ error: 'tool call not found' }, 404);
        }
        return c.json(record);
    });
    // List hypotheses for an incident (hypothesis + debate modes only)
    app.get('/:incidentId/hypotheses', async (c) => {
        if (!useCases.listHypotheses) {
            return c.json({ hypotheses: [] });
        }
        const tenantId = c.get('tenantId');
        const id = incidentId(c.req.param('incidentId'));
        const hypotheses = await useCases.listHypotheses.execute(tenantId, id);
        return c.json({ hypotheses });
    });
    return app;
}
