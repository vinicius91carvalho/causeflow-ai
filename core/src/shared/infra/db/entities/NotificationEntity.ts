import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const NotificationEntity = new Entity({
    model: { entity: 'notification', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        notificationId: { type: 'string', required: true },
        channelId: { type: 'string', required: true },
        threadId: { type: 'string' },
        type: { type: ['message', 'approval_request', 'update'], required: true },
        title: { type: 'string', default: '' },
        text: { type: 'string', required: true },
        blocks: { type: 'any' },
        status: { type: ['pending', 'delivered', 'read', 'expired'], required: true, default: 'pending' },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
        updatedAt: { type: 'string', required: true, default: () => new Date().toISOString(), watch: '*', set: () => new Date().toISOString() },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['tenantId'] },
            sk: { field: 'sk', composite: ['notificationId'] },
        },
        byChannel: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId'] },
            sk: { field: 'gsi1sk', composite: ['channelId', 'createdAt'] },
        },
        byStatus: {
            index: 'gsi2',
            pk: { field: 'gsi2pk', composite: ['tenantId', 'status'] },
            sk: { field: 'gsi2sk', composite: ['createdAt'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
