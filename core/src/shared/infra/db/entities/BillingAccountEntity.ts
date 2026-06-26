import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const BillingAccountEntity = new Entity({
    model: { entity: 'billingAccount', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        investigationsLimit: { type: 'number', required: true, default: 15 },
        investigationsUsed: { type: 'number', required: true, default: 0 },
        eventsLimit: { type: 'number', required: true, default: 500 },
        eventsUsed: { type: 'number', required: true, default: 0 },
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
            sk: { field: 'sk', composite: [] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
