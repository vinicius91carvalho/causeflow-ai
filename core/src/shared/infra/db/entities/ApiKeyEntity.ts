import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const ApiKeyEntity = new Entity(
  {
    model: { entity: 'apiKey', version: '1', service: 'causeflow' },
    attributes: {
      keyId: { type: 'string', required: true },
      tenantId: { type: 'string', required: true },
      name: { type: 'string', required: true },
      keyHash: { type: 'string', required: true },
      prefix: { type: 'string', required: true },
      status: { type: ['active', 'revoked'], required: true, default: 'active' },
      webhookSecretHash: { type: 'string' },
      scopes: { type: 'list', items: { type: 'string' } },
      createdBy: { type: 'string' },
      createdByEmail: { type: 'string' },
      lastUsedAt: { type: 'string' },
      revokedAt: { type: 'string' },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['keyHash'] },
        sk: { field: 'sk', composite: [] },
      },
      byTenant: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['tenantId'] },
        sk: { field: 'gsi1sk', composite: ['keyId'] },
      },
    },
  },
  { client: getDynamoClient(), table: TABLE_NAME },
);
