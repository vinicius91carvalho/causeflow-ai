import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';

/** 10-minute TTL for OAuth state tokens */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export const SlackOAuthStateEntity = new Entity({
    model: { entity: 'slackOAuthState', version: '1', service: 'causeflow' },
    attributes: {
        state: { type: 'string', required: true },
        tenantId: { type: 'string', required: true },
        // DynamoDB native TTL (epoch seconds)
        ttl: { type: 'number', required: true },
        createdAt: {
            type: 'string',
            required: true,
            default: () => new Date().toISOString(),
            readOnly: true,
        },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['state'] },
            sk: { field: 'sk', composite: [] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
