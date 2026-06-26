import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';

export const WidgetSessionEntity = new Entity({
    model: { entity: 'widgetSession', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        sessionId: { type: 'string', required: true },
        agentId: { type: 'string' },
        agentName: { type: 'string' },
        messages: { type: 'any', default: [] },
        status: { type: ['active', 'closed'], required: true, default: 'active' },
        pushSubscription: { type: 'any' },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
        updatedAt: { type: 'string', required: true, default: () => new Date().toISOString(), watch: '*', set: () => new Date().toISOString() },
        expiresAt: { type: 'number', required: true },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['tenantId'] },
            sk: { field: 'sk', composite: ['sessionId'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
