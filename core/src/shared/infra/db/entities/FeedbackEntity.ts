import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const FeedbackEntity = new Entity({
    model: { entity: 'feedback', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        feedbackId: { type: 'string', required: true },
        incidentId: { type: 'string', required: true },
        patternId: { type: 'string', default: 'none' },
        type: { type: 'string', required: true },
        actor: { type: 'string', required: true },
        channel: {
            type: ['api', 'slack', 'teams', 'dashboard'],
            required: true,
            default: 'api',
        },
        originalValue: { type: 'string' },
        correctedValue: { type: 'string' },
        freeText: { type: 'string' },
        agentRole: { type: 'string' },
        quality: { type: 'number' },
        confidenceDelta: { type: 'number', required: true },
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
            sk: { field: 'sk', composite: ['feedbackId'] },
        },
        byIncident: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId', 'incidentId'] },
            sk: { field: 'gsi1sk', composite: ['createdAt'] },
        },
        byPattern: {
            index: 'gsi2',
            pk: { field: 'gsi2pk', composite: ['tenantId', 'patternId'] },
            sk: { field: 'gsi2sk', composite: ['createdAt'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
