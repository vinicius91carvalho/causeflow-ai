import { logger } from '../../infra/logger.js';
import type { IEventBus, DomainEvent } from '../../domain/events.js';
import type { AgentMemory } from '../ports/agent-memory.port.js';
const PROVIDER_CATEGORIES = {
    slack: 'communication', teams: 'communication', discord: 'communication',
    gitlab: 'code', bitbucket: 'code',
    jira: 'project-management', linear: 'project-management', trello: 'project-management',
    shortcut: 'project-management', clickup: 'project-management', asana: 'project-management',
    datadog: 'monitoring', sentry: 'monitoring', pagerduty: 'monitoring', newrelic: 'monitoring',
    grafana: 'monitoring', cloudwatch: 'monitoring',
    notion: 'knowledge', confluence: 'knowledge',
    postgresql: 'database', mongodb: 'database',
    aws: 'cloud',
};
export function registerIntegrationToMemorySubscriber(deps: { eventBus: IEventBus; agentMemory: AgentMemory }): void {
    deps.eventBus.subscribe('integration.connected', async (event: DomainEvent) => {
        const tenantId = event.tenantId;
        const provider = (event.payload['provider'] as string) ?? 'unknown';
        const connectedBy = (event.payload['connectedBy'] as string) ?? 'unknown';
        const category = PROVIDER_CATEGORIES[provider.toLowerCase() as keyof typeof PROVIDER_CATEGORIES] ?? 'other';
        try {
            await deps.agentMemory.retain(tenantId, `Tenant connected ${provider} (${category}) integration. Connected by ${connectedBy} on ${event.occurredAt}. ` +
                `This means CauseFlow can now use ${provider} tools during investigations.`, {
                tags: ['integration', `provider:${provider}`, `category:${category}`],
                context: `integration-connected:${provider}`,
            });
            logger.info({ tenantId, provider }, 'Integration connection retained in memory');
        }
        catch (err) {
            logger.warn({ err, tenantId, provider }, 'Failed to retain integration connection — non-critical');
        }
    });
    deps.eventBus.subscribe('integration.disconnected', async (event: DomainEvent) => {
        const tenantId = event.tenantId;
        const provider = (event.payload['provider'] as string) ?? 'unknown';
        try {
            await deps.agentMemory.retain(tenantId, `Tenant disconnected ${provider} integration on ${event.occurredAt}. ` +
                `${provider} tools are no longer available for investigations.`, {
                tags: ['integration', `provider:${provider}`],
                context: `integration-disconnected:${provider}`,
            });
        }
        catch (err) {
            logger.warn({ err, tenantId, provider }, 'Failed to retain integration disconnection — non-critical');
        }
    });
}
