import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const ToolCallEntity = new Entity({
    model: { entity: 'toolCall', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        incidentId: { type: 'string', required: true },
        toolCallId: { type: 'string', required: true },
        agentRole: { type: ['coordinator', 'orchestrator', 'log_analyst', 'metric_analyst', 'infra_inspector', 'change_detector', 'code_analyzer', 'code_fixer', 'remediator', 'db_analyst', 'operator', 'issue_correlator', 'apm_analyst', 'notification_sender', 'falsifier', 'scout', 'diagnosis_verifier'], required: true },
        name: { type: 'string', required: true },
        origin: { type: ['real', 'synthetic_memory'], required: true, default: 'real' },
        input: { type: 'any', required: true },
        output: { type: 'string', required: true },
        success: { type: 'boolean', required: true, default: true },
        metadata: { type: 'map', properties: {
                provider: { type: 'string' },
                label: { type: 'string' },
            } },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
        primary: { collection: 'incidentDetails', pk: { field: 'pk', composite: ['tenantId'] }, sk: { field: 'sk', composite: ['incidentId', 'toolCallId'] } },
        byIncident: { index: 'gsi1', pk: { field: 'gsi1pk', composite: ['incidentId'] }, sk: { field: 'gsi1sk', composite: ['createdAt'] } },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
