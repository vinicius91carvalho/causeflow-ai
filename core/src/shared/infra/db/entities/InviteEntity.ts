import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const InviteEntity = new Entity({
    model: { entity: 'invite', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        email: { type: 'string', required: true },
        invitedBy: { type: 'string', required: true },
        role: { type: ['admin', 'member'], required: true, default: 'member' },
        status: { type: ['pending', 'accepted', 'expired', 'revoked'], required: true, default: 'pending' },
        expiresAt: { type: 'string', required: true },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
        updatedAt: { type: 'string', required: true, default: () => new Date().toISOString(), watch: '*', set: () => new Date().toISOString() },
    },
    indexes: {
        primary: { pk: { field: 'pk', composite: ['tenantId'] }, sk: { field: 'sk', composite: ['email'] } },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
