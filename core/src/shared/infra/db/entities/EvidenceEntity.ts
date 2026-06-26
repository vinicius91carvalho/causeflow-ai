import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const EvidenceEntity = new Entity({
    model: { entity: 'evidence', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        incidentId: { type: 'string', required: true },
        evidenceId: { type: 'string', required: true },
        agentRole: { type: ['coordinator', 'orchestrator', 'log_analyst', 'metric_analyst', 'infra_inspector', 'change_detector', 'code_analyzer', 'code_fixer', 'remediator', 'db_analyst', 'operator', 'issue_correlator', 'apm_analyst', 'notification_sender', 'falsifier', 'scout', 'diagnosis_verifier'], required: true },
        evidenceType: { type: ['log_snippet', 'metric_snapshot', 'trace_span', 'resource_state', 'agent_reasoning', 'user_context', 'historical_context'], required: true },
        content: { type: 'string', required: true },
        toolCallId: { type: 'string' },
        claim: { type: 'string' },
        quote: { type: 'string' },
        metadata: { type: 'map', properties: {
                source: { type: 'string' },
                timeRange: { type: 'string' },
                confidence: { type: 'number' },
                category: { type: 'string' },
                toolName: { type: 'string' },
                label: { type: 'string' },
            } },
        createdAt: { type: 'string', required: true, default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
        primary: { collection: 'incidentDetails', pk: { field: 'pk', composite: ['tenantId'] }, sk: { field: 'sk', composite: ['incidentId', 'evidenceId'] } },
        byAgentRole: { index: 'gsi1', pk: { field: 'gsi1pk', composite: ['incidentId'] }, sk: { field: 'gsi1sk', composite: ['agentRole'] } },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
