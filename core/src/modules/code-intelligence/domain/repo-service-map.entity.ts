import type { TenantId, ServiceNodeId } from '../../../shared/domain/value-objects.js';
export interface RepoServiceMap {
    tenantId: TenantId;
    repoFullName: string;
    serviceId: ServiceNodeId;
    deployTarget?: string;
    environment?: string;
    createdAt: string;
    updatedAt: string;
}
