import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const IncidentEntity = new Entity(
  {
    model: { entity: 'incident', version: '1', service: 'causeflow' },
    attributes: {
      tenantId: { type: 'string', required: true },
      incidentId: { type: 'string', required: true },
      title: { type: 'string', required: true },
      description: { type: 'string' },
      severity: { type: ['critical', 'high', 'medium', 'low', 'info'], required: true },
      status: {
        type: [
          'open',
          'triaging',
          'investigating',
          'awaiting_approval',
          'remediating',
          'resolved',
          'closed',
          'aborted',
          'cost_exceeded',
          'failed',
          'inconclusive',
        ],
        required: true,
        default: 'open',
      },
      sourceProvider: { type: 'string', required: true },
      sourceAlertId: { type: 'string' },
      assignedAgents: { type: 'list', items: { type: 'string' } },
      rootCause: { type: 'string' },
      recommendedActions: { type: 'any' },
      knownSolutionPatternId: { type: 'string' },
      knownSolutionStatus: { type: ['pending', 'accepted', 'declined'] },
      customerExplanation: { type: 'any' },
      totalCostUsd: { type: 'number' },
      costBreakdown: { type: 'any' },
      investigationDurationMs: { type: 'number' },
      investigationMode: { type: ['orchestrator', 'hypothesis', 'debate'] },
      shadowInvestigationMode: { type: ['orchestrator', 'hypothesis', 'debate'] },
      resolution: { type: 'string' },
      resolvedAt: { type: 'string' },
      slackNotificationTs: { type: 'string' },
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
        collection: 'incidentDetails',
        pk: { field: 'pk', composite: ['tenantId'] },
        sk: { field: 'sk', composite: ['incidentId'] },
      },
      bySeverityStatus: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['tenantId', 'severity'] },
        sk: { field: 'gsi1sk', composite: ['status'] },
      },
      byCreatedAt: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['tenantId'] },
        sk: { field: 'gsi2sk', composite: ['createdAt'] },
      },
      bySourceAlert: {
        index: 'gsi3',
        pk: { field: 'gsi3pk', composite: ['tenantId', 'sourceProvider'] },
        sk: { field: 'gsi3sk', composite: ['sourceAlertId'] },
      },
    },
  },
  { client: getDynamoClient(), table: TABLE_NAME },
);
