import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const OAuthTokenEntity = new Entity({
    model: { entity: 'oauthToken', version: '2', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        provider: { type: ['trello', 'notion', 'shortcut', 'jira', 'linear', 'hubspot', 'confluence'], required: true },
        // Encrypted envelope — NEVER stores plaintext tokens
        encryptedToken: { type: 'string', required: true },
        encryptedDek: { type: 'string', required: true },
        tokenIv: { type: 'string', required: true },
        tokenTag: { type: 'string', required: true },
        // Refresh token (also encrypted — same envelope fields prefixed)
        encryptedRefreshToken: { type: 'string' },
        refreshDek: { type: 'string' },
        refreshIv: { type: 'string' },
        refreshTag: { type: 'string' },
        expiresAt: { type: 'string' },
        scopes: { type: 'list', items: { type: 'string' } },
        metadata: { type: 'map', properties: {
                workspaceId: { type: 'string' },
                workspaceName: { type: 'string' },
                userId: { type: 'string' },
            } },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
        updatedAt: { type: 'string', required: true, default: () => new Date().toISOString(), watch: '*', set: () => new Date().toISOString() },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['tenantId'] },
            sk: { field: 'sk', composite: ['provider'] },
        },
        byProvider: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['provider'] },
            sk: { field: 'gsi1sk', composite: ['tenantId'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
