import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';

export const ChatMessageEntity = new Entity({
    model: { entity: 'chatMessage', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        chatId: { type: 'string', required: true },
        messageId: { type: 'string', required: true },
        role: { type: ['user', 'assistant'] as const, required: true },
        content: { type: 'string', required: true },
        intent: { type: ['memory_only', 'live_check', 'incident', 'general', 'knowledge'] as const },
        status: { type: ['completed', 'processing', 'error'] as const },
        costUsd: { type: 'number' },
        liveDataChecked: { type: 'boolean' },
        toolCallsCount: { type: 'number' },
        slackThreadId: { type: 'string' },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['tenantId'] },
            sk: { field: 'sk', composite: ['chatId', 'messageId'] },
        },
        byChatCreated: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId'] },
            sk: { field: 'gsi1sk', composite: ['createdAt'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
