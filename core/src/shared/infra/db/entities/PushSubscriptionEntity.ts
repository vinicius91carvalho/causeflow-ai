import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';

export const PushSubscriptionEntity = new Entity(
  {
    model: { entity: 'push_subscription', version: '1', service: 'causeflow' },
    attributes: {
      tenantId: { type: 'string', required: true },
      endpoint: { type: 'string', required: true },
      keys: { type: 'any', required: true },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      updatedAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        watch: '*',
        set: () => new Date().toISOString(),
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['tenantId'] },
        sk: { field: 'sk', composite: ['endpoint'] },
      },
    },
  },
  { client: getDynamoClient(), table: TABLE_NAME },
);
