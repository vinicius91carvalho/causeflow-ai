import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const TriggerEntity = new Entity({
    model: { entity: 'trigger', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        triggerId: { type: 'string', required: true },
        triggerSlug: { type: 'string', required: true },
        provider: { type: 'string', required: true },
        composioTriggerId: { type: 'string', required: true },
        connectedAccountId: { type: 'string', required: true },
        config: { type: 'any', default: {} },
        status: { type: ['active', 'paused', 'error'], default: 'active' },
        lastEventAt: { type: 'string' },
        eventCount: { type: 'number', default: 0 },
        createdAt: { type: 'string', required: true, readOnly: true, default: () => new Date().toISOString() },
        updatedAt: { type: 'string', required: true, watch: '*', default: () => new Date().toISOString(), set: () => new Date().toISOString() },
        // Composite key for duplicate-trigger detection — used by gsi2 index
        tenantProviderSlug: {
            type: 'string',
            watch: ['tenantId', 'provider', 'triggerSlug'],
            set: (_val: string | undefined, item: { tenantId?: string; provider?: string; triggerSlug?: string }) =>
                `${item.tenantId ?? ''}#${item.provider ?? ''}#${item.triggerSlug ?? ''}`,
        },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['tenantId'] },
            sk: { field: 'sk', composite: ['triggerId'] },
        },
        byComposioTrigger: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['composioTriggerId'] },
            sk: { field: 'gsi1sk', composite: ['tenantId'] },
        },
        byTenantProviderSlug: {
            // gsi2 is pre-provisioned on the shared DynamoDB table (3 GSIs available: gsi1, gsi2, gsi3)
            // TriggerEntity only used gsi1 previously; gsi2 is free for this index.
            index: 'gsi2',
            pk: { field: 'gsi2pk', composite: ['tenantProviderSlug'] },
            sk: { field: 'gsi2sk', composite: ['triggerId'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
