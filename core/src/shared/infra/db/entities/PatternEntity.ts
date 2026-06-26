import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const PatternEntity = new Entity({
    model: { entity: 'pattern', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        patternId: { type: 'string', required: true },
        symptoms: {
            type: 'list',
            items: {
                type: 'map',
                properties: {
                    signal: { type: 'string', required: true },
                    service: { type: 'string', required: true },
                    threshold: { type: 'string' },
                },
            },
        },
        serviceType: { type: 'string' },
        infraContext: { type: 'string' },
        rootCause: {
            type: 'map',
            properties: {
                category: { type: 'string', required: true },
                description: { type: 'string', required: true },
                evidence: { type: 'list', items: { type: 'string' } },
            },
        },
        fix: {
            type: 'map',
            properties: {
                action: { type: 'string', required: true },
                description: { type: 'string', required: true },
                automated: { type: 'boolean', required: true },
            },
        },
        confidence: { type: 'number', required: true },
        occurrences: { type: 'number', required: true, default: 1 },
        confirmations: { type: 'number', required: true, default: 0 },
        rejections: { type: 'number', required: true, default: 0 },
        status: {
            type: ['learning', 'stable', 'runbook_candidate', 'auto_remediation', 'deprecated'],
            required: true,
            default: 'learning',
        },
        sourceIncidents: { type: 'list', items: { type: 'string' } },
        firstSeen: { type: 'string', required: true },
        lastSeen: { type: 'string', required: true },
        lastFeedback: { type: 'string' },
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
            sk: { field: 'sk', composite: ['patternId'] },
        },
        byStatus: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId'] },
            sk: { field: 'gsi1sk', composite: ['status'] },
        },
        byConfidence: {
            index: 'gsi2',
            pk: { field: 'gsi2pk', composite: ['tenantId'] },
            sk: { field: 'gsi2sk', composite: ['confidence'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
