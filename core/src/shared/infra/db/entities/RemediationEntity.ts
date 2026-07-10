import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const RemediationEntity = new Entity({
    model: { entity: 'remediation', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        remediationId: { type: 'string', required: true },
        incidentId: { type: 'string', required: true },
        rollbackOf: { type: 'string' },
        status: {
            type: ['proposed', 'approved', 'rejected', 'executing', 'completed', 'failed'],
            required: true,
            default: 'proposed',
        },
        description: { type: 'string', required: true },
        rootCause: { type: 'string', required: true },
        steps: {
            type: 'list',
            items: {
                type: 'map',
                properties: {
                    stepIndex: { type: 'number', required: true },
                    action: { type: 'string', required: true },
                    label: { type: 'string' },
                    description: { type: 'string' },
                    riskLevel: { type: ['low', 'medium', 'high'] },
                    automated: { type: 'boolean', default: false },
                    params: { type: 'any' },
                    status: {
                        type: ['pending', 'running', 'completed', 'succeeded', 'failed', 'skipped'],
                        required: true,
                        default: 'pending',
                    },
                    beforeState: { type: 'any' },
                    afterState: { type: 'any' },
                    output: { type: 'string' },
                    costUsd: { type: 'number' },
                    durationMs: { type: 'number' },
                    startedAt: { type: 'string' },
                    completedAt: { type: 'string' },
                },
            },
        },
        pullRequests: {
            type: 'list',
            items: {
                type: 'map',
                properties: {
                    repoFullName: { type: 'string', required: true },
                    prNumber: { type: 'number', required: true },
                    prUrl: { type: 'string', required: true },
                    branch: { type: 'string', required: true },
                    status: {
                        type: ['open', 'merged', 'closed'],
                        required: true,
                        default: 'open',
                    },
                },
            },
        },
        totalCostUsd: { type: 'number' },
        totalDurationMs: { type: 'number' },
        proposedBy: { type: 'string', required: true },
        approvedBy: { type: 'string' },
        rejectedBy: { type: 'string' },
        rejectionReason: { type: 'string' },
        completedAt: { type: 'string' },
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
            sk: { field: 'sk', composite: ['remediationId'] },
        },
        byIncident: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId'] },
            sk: { field: 'gsi1sk', composite: ['incidentId', 'remediationId'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
