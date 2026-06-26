import type { AgentRole } from '../../domain/types.js';
import type { CloudCredentials } from './cloud-provider.port.js';
export interface CredentialRequest {
    tenantId: string;
    incidentId: string;
    agentRole: AgentRole;
    provider: string;
    requestedPermissions: string[];
}
export interface CredentialVendor {
    vend(request: CredentialRequest): Promise<CloudCredentials>;
    revoke(tenantId: string, incidentId: string): Promise<void>;
}
