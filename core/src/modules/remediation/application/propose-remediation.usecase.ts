import { randomUUID } from 'node:crypto';
import { remediationId } from '../../../shared/domain/value-objects.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { RemediationAlreadyExistsError } from '../domain/remediation.errors.js';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ChatPlatform } from '../../../shared/application/ports/chat-platform.port.js';
import type { StructuredAction, ProposedFix } from '../../investigation/domain/investigation.types.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

export interface ProposeRemediationInput {
    tenantId: TenantId;
    incidentId: IncidentId;
    rootCause: string;
    recommendedActions: StructuredAction[];
    proposedFix?: ProposedFix;
    actorUserId?: string;
    actorEmail?: string;
}

export class ProposeRemediationUseCase {
    remediationRepo;
    incidentRepo;
    eventBus;
    chatPlatform;
    constructor(remediationRepo: IRemediationRepository, incidentRepo: IIncidentRepository, eventBus: IEventBus, chatPlatform?: ChatPlatform) {
        this.remediationRepo = remediationRepo;
        this.incidentRepo = incidentRepo;
        this.eventBus = eventBus;
        this.chatPlatform = chatPlatform;
    }
    async execute(input: ProposeRemediationInput): Promise<Remediation> {
        const { tenantId, incidentId, rootCause, recommendedActions } = input;
        // 1. Validate incident exists
        const incident = await this.incidentRepo.findById(tenantId, incidentId);
        if (!incident) {
            throw new NotFoundError('Incident', incidentId);
        }
        // 2. Check no active remediation exists
        const existing = await this.remediationRepo.findByIncident(tenantId, incidentId);
        const active = existing.find((r) => !['rejected', 'failed', 'completed'].includes(r.status));
        if (active) {
            throw new RemediationAlreadyExistsError(incidentId);
        }
        // 3. Build steps from recommended actions (carry metadata from LLM)
        const steps = recommendedActions.map((sa, idx) => ({
            stepIndex: idx,
            action: sa.action,
            label: sa.label ?? sa.action,
            description: sa.description ?? '',
            riskLevel: sa.riskLevel ?? 'medium',
            automated: sa.automated ?? false,
            params: sa.params,
            status: 'pending',
        }));
        // 4. Create remediation
        const now = new Date().toISOString();
        let description = `Remediation for: ${rootCause}`;
        if (input.proposedFix && input.proposedFix.files.length > 0) {
            const fixFiles = input.proposedFix.files.map((f) => f.path).join(', ');
            description += `\n\nProposed code fix: ${input.proposedFix.summary}\nAffected files: ${fixFiles}\nA draft PR will be created upon approval.`;
        }
        const remediation = {
            remediationId: remediationId(randomUUID()),
            tenantId,
            incidentId,
            status: 'proposed',
            description,
            rootCause,
            steps,
            proposedBy: 'system',
            createdAt: now,
            updatedAt: now,
        };
        const created = await this.remediationRepo.create(remediation as Remediation);
        // 5. Transition incident to awaiting_approval
        await this.incidentRepo.updateStatus(tenantId, incidentId, 'awaiting_approval');
        // 6. Publish event
        await this.eventBus.publish({
            eventType: 'remediation.proposed',
            occurredAt: now,
            tenantId,
            payload: {
                incidentId,
                remediationId: created.remediationId,
                description,
                actorUserId: input.actorUserId,
                actorEmail: input.actorEmail,
            },
        });
        // 7. Request approval via chat platform
        if (this.chatPlatform) {
            await this.chatPlatform.requestApproval({
                channelId: tenantId,
                title: `Remediation Proposal: ${incident.title}`,
                description: `Root cause: ${rootCause}\n\nSteps:\n${recommendedActions.map((sa, i) => `${i + 1}. *${sa.label ?? sa.action}* (${sa.riskLevel ?? 'medium'} risk, ${sa.estimatedDuration ?? '?'})\n   ${sa.description ?? ''}`).join('\n')}`,
                actions: [
                    { label: 'Approve', value: 'approve', style: 'primary' },
                    { label: 'Reject', value: 'reject', style: 'danger' },
                ],
                timeoutMinutes: 30,
                metadata: {
                    incidentId,
                    remediationId: created.remediationId,
                },
            });
        }
        return created;
    }
}
