import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const UserSettingsEntity = new Entity({
    model: { entity: 'userSettings', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        userId: { type: 'string', required: true },
        theme: { type: ['light', 'dark', 'system'], default: 'system' },
        locale: { type: ['en', 'pt-br'], default: 'en' },
        notifications: {
            type: 'map',
            properties: {
                emailOnComplete: { type: 'boolean', default: true },
                emailOnError: { type: 'boolean', default: true },
                slackOnComplete: { type: 'boolean', default: false },
                slackOnError: { type: 'boolean', default: true },
            },
        },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
        updatedAt: { type: 'string', required: true, default: () => new Date().toISOString(), watch: '*', set: () => new Date().toISOString() },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['tenantId'] },
            sk: { field: 'sk', composite: ['userId'], template: 'settings#${userId}' },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
