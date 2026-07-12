import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const UsageRecordEntity = new Entity(
  {
    model: { entity: 'usageRecord', version: '1', service: 'causeflow' },
    attributes: {
      tenantId: { type: 'string', required: true },
      recordId: { type: 'string', required: true },
      type: { type: ['investigation', 'event', 'daily_rollup'], required: true },
      incidentId: { type: 'string' },
      costUsd: { type: 'number' },
      agentBreakdown: { type: 'any' },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['tenantId'] },
        sk: { field: 'sk', composite: ['recordId'] },
      },
      byType: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['tenantId', 'type'] },
        sk: { field: 'gsi1sk', composite: ['createdAt'] },
      },
    },
  },
  { client: getDynamoClient(), table: TABLE_NAME },
);
