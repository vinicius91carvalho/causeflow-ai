import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const RunbookRegistryEntity = new Entity({
    model: { entity: 'runbook_registry', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        rootCauseHash: { type: 'string', required: true },
        rootCauseSummary: { type: 'string', required: true },
        occurrences: { type: 'number', required: true, default: 1 },
        confirmations: { type: 'number', required: true, default: 0 },
        lastSeen: { type: 'string', required: true },
        fixAction: { type: 'string', default: '' },
        fixDescription: { type: 'string', default: '' },
        automated: { type: 'boolean', default: false },
        createdAt: { type: 'string', required: true },
        updatedAt: { type: 'string', required: true },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['tenantId'] },
            sk: { field: 'sk', composite: ['rootCauseHash'] },
        },
        byTenant: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId'] },
            sk: { field: 'gsi1sk', composite: ['occurrences'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
