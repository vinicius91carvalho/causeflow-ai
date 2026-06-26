import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const ApprovalEntity = new Entity({
    model: { entity: 'approval', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        approvalId: { type: 'string', required: true },
        notificationId: { type: 'string', required: true },
        incidentId: { type: 'string', default: '' },
        remediationId: { type: 'string', default: '' },
        title: { type: 'string', required: true },
        description: { type: 'string', required: true },
        actions: { type: 'any', required: true },
        status: { type: ['pending', 'approved', 'rejected', 'expired'], required: true, default: 'pending' },
        respondedBy: { type: 'string' },
        selectedAction: { type: 'string' },
        timeoutMinutes: { type: 'number', required: true, default: 30 },
        expiresAt: { type: 'string', required: true },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
        updatedAt: { type: 'string', required: true, default: () => new Date().toISOString(), watch: '*', set: () => new Date().toISOString() },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['tenantId'] },
            sk: { field: 'sk', composite: ['approvalId'] },
        },
        byStatus: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId', 'status'] },
            sk: { field: 'gsi1sk', composite: ['expiresAt'] },
        },
        byNotification: {
            index: 'gsi2',
            pk: { field: 'gsi2pk', composite: ['tenantId'] },
            sk: { field: 'gsi2sk', composite: ['notificationId'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
