import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const ChangeEventEntity = new Entity({
    model: { entity: 'changeEvent', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        changeId: { type: 'string', required: true },
        changeType: {
            type: ['deployment', 'config_change', 'scaling', 'rollback', 'infra_change', 'secret_rotation'],
            required: true,
        },
        serviceId: { type: 'string', required: true },
        description: { type: 'string', required: true },
        source: { type: 'string', required: true },
        timestamp: { type: 'string', required: true },
        riskScore: { type: 'number', required: true, default: 0 },
        diff: {
            type: 'map',
            properties: {
                before: { type: 'string' },
                after: { type: 'string' },
                summary: { type: 'string', required: true },
            },
        },
        linkedIncidentId: { type: 'string' },
        metadata: { type: 'any' },
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
            sk: { field: 'sk', composite: ['changeId'] },
        },
        byService: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId', 'serviceId'] },
            sk: { field: 'gsi1sk', composite: ['timestamp'] },
        },
        byTime: {
            index: 'gsi2',
            pk: { field: 'gsi2pk', composite: ['tenantId'] },
            sk: { field: 'gsi2sk', composite: ['timestamp'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
