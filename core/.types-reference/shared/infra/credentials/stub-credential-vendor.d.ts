import type { CredentialVendor, CredentialRequest } from '../../application/ports/credential-vendor.port.js';
import type { CloudCredentials } from '../../application/ports/cloud-provider.port.js';
export declare class StubCredentialVendor implements CredentialVendor {
    vend(request: CredentialRequest): Promise<CloudCredentials>;
    revoke(_tenantId: string, _incidentId: string): Promise<void>;
}
