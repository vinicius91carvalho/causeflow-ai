import { IntegrationEntity } from '../../../shared/infra/db/entities/IntegrationEntity.js';
import { integrationId } from '../../../shared/domain/value-objects.js';
import { logger } from '../../../shared/infra/logger.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TokenEncryption } from '../../../shared/application/ports/token-encryption.port.js';

export interface CloudIntegrationInfo {
    roleArn: string;
    externalId: string;
    region?: string;
}

export class GetCloudIntegrationUseCase {
    constructor(private encryption?: TokenEncryption) {}

    async execute(tenantId: TenantId): Promise<CloudIntegrationInfo | null> {
        const intId = integrationId('aws-credential');
        const result = await IntegrationEntity.get({ tenantId, integrationId: intId }).go();
        const integration = result.data;
        logger.info({
            tenantId,
            found: !!integration,
            status: integration?.status,
            hasEncrypted: !!integration?.encryptedCredentials,
            hasDek: !!integration?.credentialDek,
            hasEncryption: !!this.encryption,
        }, 'GetCloudIntegration: lookup result');
        if (!integration || integration.status !== 'active') {
            return null;
        }

        // Decrypt credentials to extract roleArn
        if (this.encryption && integration.encryptedCredentials && integration.credentialDek && integration.credentialIv && integration.credentialTag) {
            try {
                const plaintext = await this.encryption.decrypt({
                    ciphertext: integration.encryptedCredentials,
                    encryptedDek: integration.credentialDek,
                    iv: integration.credentialIv,
                    tag: integration.credentialTag,
                });
                const credentials = JSON.parse(plaintext) as Record<string, string>;
                logger.info({ tenantId, credentialKeys: Object.keys(credentials), hasRoleArn: !!credentials.roleArn }, 'GetCloudIntegration: decrypted credential fields');
                const roleArn = credentials.roleArn;
                if (!roleArn) return null;
                return {
                    roleArn,
                    externalId: String(tenantId),
                    region: credentials.region,
                };
            } catch (err) {
                logger.error({ err: err instanceof Error ? err.message : err, tenantId }, 'Failed to decrypt AWS credentials');
                return null;
            }
        }

        return null;
    }
}
