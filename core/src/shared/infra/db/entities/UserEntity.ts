import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const UserEntity = new Entity({
    model: { entity: 'user', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        userId: { type: 'string', required: true },
        email: { type: 'string', required: true },
        name: { type: 'string', required: true },
        role: { type: ['admin', 'member'], required: true, default: 'member' },
        profileComplete: { type: 'boolean', default: false },
        termsAcceptedAt: { type: 'string' },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
        updatedAt: { type: 'string', required: true, default: () => new Date().toISOString(), watch: '*', set: () => new Date().toISOString() },
    },
    indexes: {
        primary: { pk: { field: 'pk', composite: ['tenantId'] }, sk: { field: 'sk', composite: ['userId'] } },
        byUserId: { index: 'gsi1', pk: { field: 'gsi1pk', composite: ['userId'] }, sk: { field: 'gsi1sk', composite: ['tenantId'] } },
        byEmail: { index: 'gsi2', pk: { field: 'gsi2pk', composite: ['email'] }, sk: { field: 'gsi2sk', composite: ['tenantId'] } },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
