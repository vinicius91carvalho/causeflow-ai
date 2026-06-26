import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface CloudIntegrationInfo {
    roleArn: string;
    externalId: string;
    region?: string;
}
export declare class GetCloudIntegrationUseCase {
    execute(tenantId: TenantId): Promise<CloudIntegrationInfo | null>;
}
