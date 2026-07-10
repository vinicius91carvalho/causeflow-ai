import { randomUUID } from 'node:crypto';
import { remediationId } from '../../../shared/domain/value-objects.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation, RemediationStep } from '../domain/remediation.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, RemediationId } from '../../../shared/domain/value-objects.js';

export interface RollbackRemediationInput {
    tenantId: TenantId;
    remediationId: RemediationId;
    actorEmail?: string;
}

export class RollbackRemediationUseCase {
    remediationRepo;
    eventBus;
    constructor(remediationRepo: IRemediationRepository, eventBus: IEventBus) {
        this.remediationRepo = remediationRepo;
        this.eventBus = eventBus;
    }
    async execute(input: RollbackRemediationInput): Promise<Remediation> {
        const { tenantId, remediationId: sourceRemediationId } = input;
        const source = await this.remediationRepo.findById(tenantId, sourceRemediationId);
        if (!source) {
            throw new NotFoundError('Remediation', sourceRemediationId);
        }
        if (source.status !== 'completed') {
            throw new ConflictError(`Remediation ${sourceRemediationId} cannot be rolled back: status is '${source.status}', expected 'completed'`);
        }
        const reversibleSteps = source.steps
            .filter((step) => step.status === 'succeeded' && step.beforeState)
            .reverse();
        const rollbackSteps: RemediationStep[] = reversibleSteps.map((step, idx) => ({
            stepIndex: idx,
            action: step.action,
            label: `Rollback: ${step.label}`,
            description: `Inverse of step ${step.stepIndex}: ${step.description}`,
            riskLevel: step.riskLevel,
            automated: step.automated,
            params: { ...step.params, ...step.beforeState },
            status: 'pending' as const,
        }));
        const now = new Date().toISOString();
        const description = `Rollback of remediation ${sourceRemediationId}`;
        const rollbackRemediation: Remediation = {
            remediationId: remediationId(randomUUID()),
            tenantId,
            incidentId: source.incidentId,
            rollbackOf: sourceRemediationId,
            status: 'proposed',
            description,
            rootCause: source.rootCause,
            steps: rollbackSteps,
            proposedBy: input.actorEmail ?? 'system',
            createdAt: now,
            updatedAt: now,
        };
        const created = await this.remediationRepo.create(rollbackRemediation);
        await this.eventBus.publish({
            eventType: 'remediation.proposed',
            occurredAt: now,
            tenantId,
            payload: {
                incidentId: source.incidentId,
                remediationId: created.remediationId,
                description,
                rollbackOf: sourceRemediationId,
                actorEmail: input.actorEmail,
            },
        });
        return created;
    }
}
