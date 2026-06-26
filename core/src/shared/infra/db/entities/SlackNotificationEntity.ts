import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';

export const SlackNotificationEntity = new Entity({
    model: { entity: 'slackNotification', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        incidentId: { type: 'string', required: true },
        type: { type: 'string', required: true },
        messageTs: { type: 'string' },
        channel: { type: 'string' },
        status: {
            type: ['pending', 'sent', 'failed'],
            required: true,
            default: 'pending',
        },
        errorMessage: { type: 'string' },
        // TTL — DynamoDB native TTL (epoch seconds), set to 30 days from creation
        ttl: { type: 'number' },
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
            sk: { field: 'sk', composite: ['incidentId', 'type'] },
        },
        byIncident: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId', 'incidentId'] },
            sk: { field: 'gsi1sk', composite: ['type'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
