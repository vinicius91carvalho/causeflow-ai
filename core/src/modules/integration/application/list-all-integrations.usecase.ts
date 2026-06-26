import { IntegrationEntity } from '../../../shared/infra/db/entities/IntegrationEntity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface IntegrationSummary {
    provider: string;
    source: 'credential';
    status: string;
    displayName: string;
    connectedBy?: string;
    createdAt: string;
    updatedAt: string;
}

export class ListAllIntegrationsUseCase {
    async execute(tenantId: TenantId): Promise<IntegrationSummary[]> {
        const results: IntegrationSummary[] = [];
        // Credential-based integrations from IntegrationEntity (includes Composio-managed)
        const credentialIntegrations = await IntegrationEntity.query.primary({ tenantId }).go();
        for (const item of credentialIntegrations.data) {
            results.push({
                provider: item.provider,
                source: 'credential',
                status: item.status,
                displayName: item.displayName,
                connectedBy: item.connectedBy ?? undefined,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            });
        }
        return results;
    }
}
