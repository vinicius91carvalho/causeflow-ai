import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const ServiceEdgeEntity = new Entity({
    model: { entity: 'serviceEdge', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        edgeId: { type: 'string', required: true },
        sourceService: { type: 'string', required: true },
        targetService: { type: 'string', required: true },
        edgeType: {
            type: ['http', 'grpc', 'tcp', 'event', 'database', 'cache', 'queue'],
            required: true,
        },
        protocol: { type: 'string' },
        traffic: {
            type: 'map',
            properties: {
                requestsPerSecond: { type: 'number' },
                avgLatencyMs: { type: 'number' },
                errorRate: { type: 'number' },
            },
        },
        isCriticalPath: { type: 'boolean', required: true, default: false },
        metadata: { type: 'any' },
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
            sk: { field: 'sk', composite: ['edgeId'] },
        },
        bySource: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId', 'sourceService'] },
            sk: { field: 'gsi1sk', composite: ['targetService'] },
        },
        byTarget: {
            index: 'gsi2',
            pk: { field: 'gsi2pk', composite: ['tenantId', 'targetService'] },
            sk: { field: 'gsi2sk', composite: ['sourceService'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
