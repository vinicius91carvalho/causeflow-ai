import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const AuditEntryEntity = new Entity(
  {
    model: { entity: 'auditEntry', version: '1', service: 'causeflow' },
    attributes: {
      tenantId: { type: 'string', required: true },
      entryId: { type: 'string', required: true },
      action: { type: 'string', required: true },
      actorType: { type: ['user', 'system', 'agent'], required: true },
      actorUserId: { type: 'string' },
      actorEmail: { type: 'string', required: true },
      pseudonymizedAt: { type: 'string' },
      resourceType: { type: 'string', required: true },
      resourceId: { type: 'string', required: true },
      changes: { type: 'string' },
      /**
       * Optional JSON-serialised AuditEvidence[] array.
       * Stored as a string to avoid ElectroDB list-of-maps limitations.
       * Additive field — absent on legacy rows (treated as undefined).
       */
      evidences: { type: 'string' },
      previousHash: { type: 'string', required: true },
      entryHash: { type: 'string', required: true },
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
        sk: { field: 'sk', composite: ['entryId'] },
      },
      byAction: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['tenantId', 'action'] },
        sk: { field: 'gsi1sk', composite: ['createdAt'] },
      },
      byActor: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['tenantId', 'actorEmail'] },
        sk: { field: 'gsi2sk', composite: ['createdAt'] },
      },
      byCreatedAt: {
        index: 'gsi3',
        pk: { field: 'gsi3pk', composite: ['tenantId'] },
        sk: { field: 'gsi3sk', composite: ['createdAt'] },
      },
    },
  },
  { client: getDynamoClient(), table: TABLE_NAME },
);
