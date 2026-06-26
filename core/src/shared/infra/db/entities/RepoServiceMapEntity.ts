import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const RepoServiceMapEntity = new Entity({
    model: { entity: 'repoServiceMap', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        repoFullName: { type: 'string', required: true },
        serviceId: { type: 'string', required: true },
        deployTarget: { type: 'string' },
        environment: { type: 'string' },
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
            pk: { field: 'pk', composite: ['tenantId', 'serviceId'] },
            sk: { field: 'sk', composite: ['repoFullName'] },
        },
        byRepo: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId', 'repoFullName'] },
            sk: { field: 'gsi1sk', composite: ['serviceId'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
