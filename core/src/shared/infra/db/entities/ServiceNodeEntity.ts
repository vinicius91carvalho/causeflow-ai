import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const ServiceNodeEntity = new Entity({
    model: { entity: 'serviceNode', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        serviceId: { type: 'string', required: true },
        name: { type: 'string', required: true },
        type: {
            type: ['api', 'database', 'cache', 'queue', 'storage', 'cdn', 'load_balancer', 'function', 'container', 'other'],
            required: true,
        },
        runtime: { type: 'string' },
        health: {
            type: 'map',
            properties: {
                status: {
                    type: ['healthy', 'degraded', 'unhealthy', 'unknown'],
                    required: true,
                },
                lastCheck: { type: 'string', required: true },
                details: { type: 'string' },
            },
            required: true,
        },
        healthStatus: {
            type: ['healthy', 'degraded', 'unhealthy', 'unknown'],
            required: true,
        },
        blastRadius: { type: 'number', required: true, default: 0 },
        criticality: {
            type: ['critical', 'high', 'medium', 'low'],
            required: true,
            default: 'medium',
        },
        ownerTeam: { type: 'string' },
        tags: { type: 'any' },
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
            sk: { field: 'sk', composite: ['serviceId'] },
        },
        byTeam: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId'] },
            sk: { field: 'gsi1sk', composite: ['ownerTeam', 'serviceId'] },
        },
        byBlastRadius: {
            index: 'gsi2',
            pk: { field: 'gsi2pk', composite: ['tenantId'] },
            sk: { field: 'gsi2sk', composite: ['blastRadius'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
