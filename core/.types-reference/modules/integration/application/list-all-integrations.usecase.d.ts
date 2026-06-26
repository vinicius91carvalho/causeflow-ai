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
export declare class ListAllIntegrationsUseCase {
    execute(tenantId: TenantId): Promise<IntegrationSummary[]>;
}
