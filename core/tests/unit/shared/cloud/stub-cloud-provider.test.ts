import { describe, it, expect } from 'vitest';
import { StubCloudProvider } from '../../../../src/shared/infra/cloud/stub-cloud-provider.js';
import type { CloudCredentials } from '../../../../src/shared/application/ports/cloud-provider.port.js';

const STUB_CREDS: CloudCredentials = {
  provider: 'stub',
  credentials: {},
  region: 'us-east-1',
};

describe('StubCloudProvider', () => {
  const provider = new StubCloudProvider();

  it('should have name "stub"', () => {
    expect(provider.name).toBe('stub');
  });

  it('should return log entries for queryLogs', async () => {
    const logs = await provider.queryLogs(STUB_CREDS, {
      service: 'api-server',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
    });

    expect(logs.length).toBeGreaterThanOrEqual(5);
    expect(logs[0]).toHaveProperty('timestamp');
    expect(logs[0]).toHaveProperty('message');
    expect(logs[0]).toHaveProperty('level');
    expect(logs[0]).toHaveProperty('service');
  });

  it('should return OOM logs when filter contains "oom"', async () => {
    const logs = await provider.queryLogs(STUB_CREDS, {
      service: 'worker',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      filter: 'oom memory issue',
    });

    const hasOomLog = logs.some((l) => l.message.includes('OOM'));
    expect(hasOomLog).toBe(true);
  });

  it('should return timeout logs when filter contains "timeout"', async () => {
    const logs = await provider.queryLogs(STUB_CREDS, {
      service: 'api',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      filter: 'connection timeout',
    });

    const hasTimeoutLog = logs.some((l) => l.message.includes('timed out'));
    expect(hasTimeoutLog).toBe(true);
  });

  it('should return metric data points with anomaly spike', async () => {
    const metrics = await provider.queryMetrics(STUB_CREDS, {
      metricName: 'CPUUtilization',
      namespace: 'AWS/ECS',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
    });

    expect(metrics.length).toBe(31);
    expect(metrics[0]).toHaveProperty('timestamp');
    expect(metrics[0]).toHaveProperty('value');
    expect(metrics[0]).toHaveProperty('unit');

    // Verify there's a spike in the data
    const values = metrics.map((m) => m.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    expect(max).toBeGreaterThan(min * 1.5);
  });

  it('should return service info for describeService', async () => {
    const info = await provider.describeService(STUB_CREDS, 'api-server', 'us-east-1');

    expect(info.name).toBe('api-server');
    expect(info.type).toBe('ECS');
    expect(info.status).toBe('ACTIVE');
    expect(info.region).toBe('us-east-1');
    expect(info.metadata).toHaveProperty('desiredCount');
    expect(info.metadata).toHaveProperty('runningCount');
  });

  it('should execute action successfully', async () => {
    const result = await provider.executeAction(STUB_CREDS, {
      resourceId: 'api-server',
      action: 'restart',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('restart');
    expect(result.beforeState).toBeDefined();
    expect(result.afterState).toBeDefined();
  });

  it('should fail deterministically for unsupported action types', async () => {
    const result = await provider.executeAction(STUB_CREDS, {
      resourceId: 'api-server',
      action: 'delete_production_cluster',
    });

    expect(result.success).toBe(false);
    expect(result.output).toContain('unsupported action');
    expect(result.beforeState).toEqual(result.afterState);
  });

  it('should record before/after desiredCount for scale_horizontal', async () => {
    const result = await provider.executeAction(STUB_CREDS, {
      resourceId: 'incident-scale-test',
      action: 'scale_horizontal',
      params: { service: 'order-service', desiredCount: 5 },
    });

    expect(result.success).toBe(true);
    expect(result.beforeState?.['desiredCount']).toBe(3);
    expect(result.afterState?.['desiredCount']).toBe(5);
  });

  it('should return true for testConnection', async () => {
    const result = await provider.testConnection(STUB_CREDS);
    expect(result).toBe(true);
  });
});
