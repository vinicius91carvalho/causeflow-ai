import { config } from '../../config/index.js';
import type { CredentialVendor, CredentialRequest } from '../../application/ports/credential-vendor.port.js';
import type { CloudCredentials } from '../../application/ports/cloud-provider.port.js';
export class StubCredentialVendor {
    async vend(request: CredentialRequest): Promise<CloudCredentials> {
        return {
            provider: 'stub',
            credentials: {},
            region: config.aws.region,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        };
    }
    async revoke(_tenantId: string, _incidentId: string): Promise<void> {
        // no-op for stub
    }
}
