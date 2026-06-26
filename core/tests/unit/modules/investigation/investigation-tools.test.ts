import { describe, it, expect, vi } from 'vitest';
import {
  createToolHandler,
  getIncidentDetailsInputSchema,
  LOG_TOOLS,
  METRIC_TOOLS,
  INFRA_TOOLS,
  CHANGE_DETECTION_TOOLS,
  ORCHESTRATOR_TOOLS,
} from '../../../../src/modules/investigation/infra/investigation-tools.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

function createMockIncidentRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      incidentId: incidentId('inc-123'),
      tenantId: tenantId('tenant-1'),
      title: 'High CPU',
      description: 'CPU at 95%',
      severity: 'critical',
      status: 'investigating',
      sourceProvider: 'datadog',
      sourceAlertId: 'dd-456',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }),
    findBySourceAlert: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

describe('Investigation Tools Handler', () => {
  const incidentRepo = createMockIncidentRepo();
  const handler = createToolHandler({
    cloudCredentials: { provider: 'stub', credentials: {}, region: 'us-east-1' },
    incidentRepo,
    tenantId: tenantId('tenant-1'),
    incidentId: incidentId('inc-123'),
  });

  it('should handle get_incident_details tool', async () => {
    const result = await handler('get_incident_details', {
      tenantId: 'tenant-1',
      incidentId: 'inc-123',
    });
    const parsed = JSON.parse(result);

    expect(parsed.title).toBe('High CPU');
    expect(parsed.severity).toBe('critical');
    expect(incidentRepo.findById).toHaveBeenCalled();
  });

  it('should throw error for unknown tool', async () => {
    await expect(handler('unknown_tool', {})).rejects.toThrow('Unknown tool: unknown_tool');
  });

  it('should throw for removed query_logs tool', async () => {
    await expect(handler('query_logs', { service: 'api' })).rejects.toThrow('Unknown tool: query_logs');
  });

  it('should throw for removed query_metrics tool', async () => {
    await expect(handler('query_metrics', { metricName: 'CPU', namespace: 'AWS/ECS' })).rejects.toThrow('Unknown tool: query_metrics');
  });

  it('should throw for removed describe_service tool', async () => {
    await expect(handler('describe_service', { serviceName: 'api' })).rejects.toThrow('Unknown tool: describe_service');
  });
});

describe('Zod Input Schemas', () => {
  it('should validate get_incident_details input', () => {
    const valid = getIncidentDetailsInputSchema.parse({ tenantId: 't-1', incidentId: 'inc-1' });
    expect(valid.tenantId).toBe('t-1');
    expect(valid.incidentId).toBe('inc-1');
  });
});

describe('Tool Groupings', () => {
  it('should include aws_api_call in all tool groupings', () => {
    for (const tools of [LOG_TOOLS, METRIC_TOOLS, INFRA_TOOLS, CHANGE_DETECTION_TOOLS]) {
      expect(tools.some(t => t.name === 'aws_api_call')).toBe(true);
    }
  });

  it('should include get_incident_details in all tool groupings', () => {
    for (const tools of [LOG_TOOLS, METRIC_TOOLS, INFRA_TOOLS, CHANGE_DETECTION_TOOLS]) {
      expect(tools.some(t => t.name === 'get_incident_details')).toBe(true);
    }
  });

  it('should not include removed tools in any grouping', () => {
    const allTools = [...LOG_TOOLS, ...METRIC_TOOLS, ...INFRA_TOOLS, ...CHANGE_DETECTION_TOOLS];
    expect(allTools.some(t => t.name === 'query_logs')).toBe(false);
    expect(allTools.some(t => t.name === 'query_metrics')).toBe(false);
    expect(allTools.some(t => t.name === 'describe_service')).toBe(false);
  });

  it('should not include removed GitHub tools (now via Composio)', () => {
    const allTools = [...LOG_TOOLS, ...METRIC_TOOLS, ...INFRA_TOOLS, ...CHANGE_DETECTION_TOOLS];
    expect(allTools.some(t => t.name === 'get_recent_commits')).toBe(false);
  });
});

describe('Orchestrator Tools', () => {
  it('should include all base tools', () => {
    expect(ORCHESTRATOR_TOOLS.some(t => t.name === 'get_incident_details')).toBe(true);
    expect(ORCHESTRATOR_TOOLS.some(t => t.name === 'aws_api_call')).toBe(true);
  });

  it('should include memory tools', () => {
    expect(ORCHESTRATOR_TOOLS.some(t => t.name === 'recall_past_incidents')).toBe(true);
    expect(ORCHESTRATOR_TOOLS.some(t => t.name === 'remember_finding')).toBe(true);
  });

  it('should not include removed GitHub tools (now via Composio)', () => {
    expect(ORCHESTRATOR_TOOLS.some(t => t.name === 'get_recent_commits')).toBe(false);
    expect(ORCHESTRATOR_TOOLS.some(t => t.name === 'get_commit_diff')).toBe(false);
  });

  it('should have JSON Schema type object in all tool definitions', () => {
    for (const tool of ORCHESTRATOR_TOOLS) {
      const schema = tool.inputSchema;
      expect(schema['type']).toBe('object');
      expect(schema['properties']).toBeDefined();
    }
  });
});
