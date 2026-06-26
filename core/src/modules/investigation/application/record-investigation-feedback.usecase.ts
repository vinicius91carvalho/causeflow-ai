import { v4 as uuidv4 } from 'uuid';
import { feedbackId } from '../../../shared/domain/value-objects.js';
import { FeedbackEntity } from '../../../shared/infra/db/entities/FeedbackEntity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { IRunbookRegistryRepository } from '../../../shared/domain/runbook-registry.repository.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

export interface InvestigationFeedbackInput {
    tenantId: TenantId;
    incidentId: IncidentId;
    type: 'investigation_accurate' | 'investigation_inaccurate' | 'investigation_partial';
    actor: string;
    freeText?: string;
    agentFeedback?: Array<{
        agentRole: string;
        quality: number;
    }>;
    rootCauseHash?: string;
}

export interface FeedbackItemDTO {
    id: string;
    incidentId: string;
    type: string;
    comment?: string;
    actor: string;
    createdAt: string;
}

export class RecordInvestigationFeedbackUseCase {
    eventBus;
    agentMemory;
    runbookRegistry;
    constructor(eventBus: IEventBus, agentMemory?: AgentMemory, runbookRegistry?: IRunbookRegistryRepository) {
        this.eventBus = eventBus;
        this.agentMemory = agentMemory;
        this.runbookRegistry = runbookRegistry;
    }
    async execute(input: InvestigationFeedbackInput): Promise<FeedbackItemDTO> {
        const { tenantId, incidentId, type, actor, freeText, agentFeedback } = input;
        const mainId = feedbackId(uuidv4());
        const now = new Date().toISOString();
        // 1. Persist to DynamoDB (critical — must succeed)
        await FeedbackEntity.create({
            tenantId: tenantId as string,
            feedbackId: mainId as string,
            incidentId: incidentId as string,
            type,
            actor,
            freeText: freeText ?? undefined,
            channel: 'dashboard',
            confidenceDelta: 0,
        }).go();
        // 2. Retain feedback in Hindsight (best-effort — don't block response)
        if (this.agentMemory) {
            const isPositive = type === 'investigation_accurate';
            const agentDetails = agentFeedback?.map((af) => `${af.agentRole}:${af.quality}/5`).join(', ') ?? '';
            const content = `Investigation feedback for incident ${incidentId}: "${type}" by ${actor}.` +
                (freeText ? ` Comment: "${freeText}".` : '') +
                (agentDetails ? ` Agent quality: ${agentDetails}.` : '');
            try {
                await this.agentMemory.retain(tenantId, content, {
                    tags: ['feedback', `incident:${incidentId}`, `verdict:${isPositive ? 'positive' : 'negative'}`],
                    context: `investigation-feedback:${incidentId}`,
                });
            } catch (err) {
                console.error('Failed to retain feedback in agent memory (non-blocking):', err);
            }
            // 3. If positive and we have a hash, increment runbook confirmations
            if (isPositive && input.rootCauseHash && this.runbookRegistry) {
                try {
                    const existing = await this.runbookRegistry.findByHash(tenantId, input.rootCauseHash);
                    if (existing) {
                        await this.runbookRegistry.upsert({
                            ...existing,
                            confirmations: existing.confirmations + 1,
                            updatedAt: new Date().toISOString(),
                        });
                    }
                } catch (err) {
                    console.error('Failed to update runbook confirmations (non-blocking):', err);
                }
            }
        }
        // 4. Publish event (best-effort — don't block response)
        try {
            await this.eventBus.publish({
                eventType: 'knowledge.feedback_recorded',
                occurredAt: now,
                tenantId,
                payload: { incidentId, type, feedbackIds: [mainId], actor },
            });
        } catch (err) {
            console.error('Failed to publish feedback event (non-blocking):', err);
        }
        return {
            id: mainId as string,
            incidentId: incidentId as string,
            type,
            comment: freeText,
            actor,
            createdAt: now,
        };
    }

    async listByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<FeedbackItemDTO[]> {
        const result = await FeedbackEntity.query.byIncident({
            tenantId: tenantId as string,
            incidentId: incidentId as string,
        }).go();
        return result.data.map((item) => ({
            id: item.feedbackId,
            incidentId: item.incidentId,
            type: item.type,
            comment: item.freeText ?? undefined,
            actor: item.actor,
            createdAt: item.createdAt,
        }));
    }
}
