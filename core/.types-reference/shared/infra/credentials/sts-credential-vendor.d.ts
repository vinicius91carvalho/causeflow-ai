import { STSClient } from '@aws-sdk/client-sts';
import type { CredentialVendor, CredentialRequest } from '../../application/ports/credential-vendor.port.js';
import type { CloudCredentials } from '../../application/ports/cloud-provider.port.js';
import type { ITenantRepository } from '../../../modules/tenant/domain/tenant.repository.js';
import type { GetCloudIntegrationUseCase } from '../../../modules/integration/application/get-cloud-integration.usecase.js';
export declare class STSCredentialVendor implements CredentialVendor {
    private readonly client;
    private readonly tenantRepo?;
    private readonly getCloudIntegration?;
    constructor(client?: STSClient, tenantRepo?: ITenantRepository, getCloudIntegration?: GetCloudIntegrationUseCase);
    private resolveRoleArn;
    vend(request: CredentialRequest): Promise<CloudCredentials>;
    revoke(_tenantId: string, _incidentId: string): Promise<void>;
}
