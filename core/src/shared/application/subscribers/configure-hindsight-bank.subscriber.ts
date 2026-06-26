import { logger } from '../../infra/logger.js';
import type { IEventBus, DomainEvent } from '../../domain/events.js';
import type { AgentMemory } from '../ports/agent-memory.port.js';
export function registerConfigureHindsightBankSubscriber(deps: { eventBus: IEventBus; agentMemory: AgentMemory }): void {
    deps.eventBus.subscribe('tenant.created', async (event: DomainEvent) => {
        const tenantId = event.tenantId;
        const tenantName = ((event.payload['name'] as string | undefined) ?? tenantId);
        try {
            await deps.agentMemory.configureBank(tenantId, {
                reflectMission: `You are the memory and reasoning engine for CauseFlow, an AI SRE platform, ` +
                    `serving tenant "${tenantName}". ` +
                    `When asked about incidents, root causes, service dependencies, or remediation outcomes, ` +
                    `synthesize your knowledge from past investigations. ` +
                    `Be precise, technical, and cite specific incident IDs when relevant. ` +
                    `Reason about causation, not just correlation.`,
                retainMission: `Extract and store: incident root causes, service dependencies discovered during investigation, ` +
                    `remediation outcomes (success, failure, made things worse), infrastructure topology relationships, ` +
                    `deployment-incident correlations, and recurring failure patterns. ` +
                    `Ignore transient metric noise and alert flapping.`,
                observationsMission: `Consolidate facts into higher-order patterns: recurring root causes per service, ` +
                    `service reliability trends, common failure modes, blast radius patterns across incidents, ` +
                    `change-incident correlations, and remediation effectiveness per action type.`,
                disposition: { skepticism: 3, literalism: 4, empathy: 1 },
                directives: [
                    {
                        name: 'causal-reasoning',
                        content: 'Never assume correlation is causation. When citing a root cause, explain the causal chain.',
                        priority: 1,
                    },
                    {
                        name: 'cite-evidence',
                        content: 'Always cite specific incident IDs, timestamps, and service names when making claims about past events.',
                        priority: 2,
                    },
                    {
                        name: 'remediation-awareness',
                        content: 'Track and distinguish between successful and failed remediations. Warn when a proposed fix has historically failed for a similar pattern.',
                        priority: 3,
                    },
                ],
            });
            logger.info({ tenantId, tenantName }, 'Hindsight bank configured for new tenant');
        }
        catch (err) {
            logger.warn({ err, tenantId }, 'Failed to configure Hindsight bank on tenant creation — non-critical');
        }
    });
}
