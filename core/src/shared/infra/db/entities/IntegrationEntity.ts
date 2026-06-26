import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const IntegrationEntity = new Entity({
    model: { entity: 'integration', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        integrationId: { type: 'string', required: true },
        provider: { type: 'string', required: true },
        category: { type: ['observability', 'alerting', 'chat', 'cloud'], required: true },
        status: { type: ['active', 'inactive', 'error', 'pending_setup'], required: true, default: 'pending_setup' },
        displayName: { type: 'string', required: true },
        config: { type: 'map', properties: {
                apiKeyRef: { type: 'string' },
                webhookUrl: { type: 'string' },
                region: { type: 'string' },
                accountId: { type: 'string' },
                roleArn: { type: 'string' },
                externalId: { type: 'string' },
            } },
        encryptedCredentials: { type: 'string' },
        credentialIv: { type: 'string' },
        credentialTag: { type: 'string' },
        credentialDek: { type: 'string' },
        connectedBy: { type: 'string' },
        lastHealthCheck: { type: 'string' },
        // Sentry HMAC verification fields (AD-2)
        clientSecretEncrypted: { type: 'string' },
        clientSecretDek: { type: 'string' },
        clientSecretIv: { type: 'string' },
        clientSecretTag: { type: 'string' },
        verified: { type: 'boolean', default: false },
        verifiedAt: { type: 'string' },
        lastEventAt: { type: 'string' },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
        updatedAt: { type: 'string', required: true, default: () => new Date().toISOString(), watch: '*', set: () => new Date().toISOString() },
    },
    indexes: {
        primary: { pk: { field: 'pk', composite: ['tenantId'] }, sk: { field: 'sk', composite: ['integrationId'] } },
        byProviderStatus: { index: 'gsi1', pk: { field: 'gsi1pk', composite: ['provider'] }, sk: { field: 'gsi1sk', composite: ['status'] } },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
