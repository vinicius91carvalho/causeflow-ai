import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CloudCredentials } from '../../../../src/shared/application/ports/cloud-provider.port.js';

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    aws: { region: 'sa-east-1' },
    cloudProvider: { logGroupPrefix: '/ecs/', insightsMaxWaitMs: 5000, ssmCommandTimeoutS: 10 },
    sts: { roleArn: 'arn:aws:iam::123456789012:role/Test', roleSessionPrefix: 'causeflow', defaultDuration: 900, maxDuration: 3600 },
  },
}));

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock AWS SDK clients
const mockCWLogsSend = vi.fn();
vi.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: vi.fn().mockImplementation(() => ({ send: mockCWLogsSend })),
  StartQueryCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  GetQueryResultsCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

const mockCWSend = vi.fn();
vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: vi.fn().mockImplementation(() => ({ send: mockCWSend })),
  GetMetricDataCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

const mockECSSend = vi.fn();
vi.mock('@aws-sdk/client-ecs', () => ({
  ECSClient: vi.fn().mockImplementation(() => ({ send: mockECSSend })),
  DescribeServicesCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  DescribeClustersCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  ListServicesCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  UpdateServiceCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  DescribeTaskDefinitionCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  RegisterTaskDefinitionCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  ListTaskDefinitionsCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

const mockEC2Send = vi.fn();
vi.mock('@aws-sdk/client-ec2', () => ({
  EC2Client: vi.fn().mockImplementation(() => ({ send: mockEC2Send })),
  DescribeInstancesCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

const mockLambdaSend = vi.fn();
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn().mockImplementation(() => ({ send: mockLambdaSend })),
  GetFunctionCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

const mockSTSSend = vi.fn();
vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: vi.fn().mockImplementation(() => ({ send: mockSTSSend })),
  GetCallerIdentityCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
  SendCommandCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  GetCommandInvocationCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

const { AWSCloudProvider } = await import('../../../../src/shared/infra/cloud/aws-cloud-provider.js');

describe('AWSCloudProvider', () => {
  const stubCreds: CloudCredentials = {
    provider: 'aws',
    credentials: {
      accessKeyId: 'AKID',
      secretAccessKey: 'SECRET',
      sessionToken: 'TOKEN',
    },
    region: 'sa-east-1',
  };

  let provider: InstanceType<typeof AWSCloudProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AWSCloudProvider();
  });

  describe('name', () => {
    it('should be aws', () => {
      expect(provider.name).toBe('aws');
    });
  });

  describe('queryLogs', () => {
    it('should start CW Logs Insights query and return results', async () => {
      mockCWLogsSend
        .mockResolvedValueOnce({ queryId: 'q-123' })
        .mockResolvedValueOnce({
          status: 'Complete',
          results: [
            [
              { field: '@timestamp', value: '2026-01-01T00:00:00Z' },
              { field: '@message', value: 'ERROR: connection timeout' },
            ],
          ],
        });

      const logs = await provider.queryLogs(stubCreds, {
        service: 'api-server',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
        filter: 'error',
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('ERROR: connection timeout');
      expect(logs[0]!.level).toBe('error');
      expect(logs[0]!.service).toBe('api-server');
    });

    it('should return empty array when query fails', async () => {
      mockCWLogsSend
        .mockResolvedValueOnce({ queryId: 'q-123' })
        .mockResolvedValueOnce({ status: 'Failed' });

      const logs = await provider.queryLogs(stubCreds, {
        service: 'api-server',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
      });

      expect(logs).toEqual([]);
    });

    it('should return empty when no queryId returned', async () => {
      mockCWLogsSend.mockResolvedValueOnce({ queryId: undefined });

      const logs = await provider.queryLogs(stubCreds, {
        service: 'api-server',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
      });

      expect(logs).toEqual([]);
    });
  });

  describe('queryMetrics', () => {
    it('should return metric data points', async () => {
      mockCWSend.mockResolvedValue({
        MetricDataResults: [
          {
            Timestamps: [new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:05:00Z')],
            Values: [45.5, 78.2],
          },
        ],
      });

      const metrics = await provider.queryMetrics(stubCreds, {
        metricName: 'CPUUtilization',
        namespace: 'AWS/ECS',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
      });

      expect(metrics).toHaveLength(2);
      expect(metrics[0]!.value).toBe(45.5);
      expect(metrics[1]!.value).toBe(78.2);
    });

    it('should return empty when no results', async () => {
      mockCWSend.mockResolvedValue({ MetricDataResults: [] });

      const metrics = await provider.queryMetrics(stubCreds, {
        metricName: 'CPUUtilization',
        namespace: 'AWS/ECS',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
      });

      expect(metrics).toEqual([]);
    });
  });

  describe('describeService', () => {
    it('should describe ECS service', async () => {
      mockECSSend
        .mockResolvedValueOnce({
          clusters: [{ clusterArn: 'arn:aws:ecs:sa-east-1:123:cluster/prod' }],
        })
        .mockResolvedValueOnce({
          services: [
            {
              serviceName: 'api-server',
              status: 'ACTIVE',
              taskDefinition: 'arn:aws:ecs:sa-east-1:123:task-definition/api:5',
              desiredCount: 3,
              runningCount: 3,
              pendingCount: 0,
              launchType: 'FARGATE',
            },
          ],
        });

      const info = await provider.describeService(stubCreds, 'api-server', 'sa-east-1');
      expect(info.name).toBe('api-server');
      expect(info.type).toBe('container');
      expect(info.status).toBe('running');
    });

    it('should fallback to Lambda when ECS not found', async () => {
      mockECSSend
        .mockResolvedValueOnce({ clusters: [{ clusterArn: 'arn:cluster' }] })
        .mockResolvedValueOnce({ services: [] });
      mockLambdaSend.mockResolvedValue({
        Configuration: {
          FunctionName: 'my-lambda',
          State: 'Active',
          Runtime: 'nodejs22.x',
          MemorySize: 512,
          Timeout: 30,
        },
      });

      const info = await provider.describeService(stubCreds, 'my-lambda', 'sa-east-1');
      expect(info.name).toBe('my-lambda');
      expect(info.type).toBe('function');
      expect(info.status).toBe('running');
    });

    it('should return unknown when service not found anywhere', async () => {
      mockECSSend.mockRejectedValue(new Error('not found'));
      mockLambdaSend.mockRejectedValue(new Error('not found'));
      mockEC2Send.mockRejectedValue(new Error('not found'));

      const info = await provider.describeService(stubCreds, 'nonexistent', 'sa-east-1');
      expect(info.status).toBe('unknown');
      expect(info.type).toBe('other');
    });
  });

  describe('executeAction', () => {
    it('should route restart_service to ECS forceNewDeployment', async () => {
      mockECSSend.mockResolvedValue({});

      const result = await provider.executeAction(stubCreds, {
        resourceId: 'inc-123',
        action: 'restart_service',
        params: { service: 'api-server', cluster: 'prod' },
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Force new deployment');
    });

    it('should route scale_service to ECS desiredCount update', async () => {
      mockECSSend.mockResolvedValue({});

      const result = await provider.executeAction(stubCreds, {
        resourceId: 'inc-123',
        action: 'scale_service',
        params: { service: 'api-server', cluster: 'prod', desiredCount: 5 },
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Scaled');
    });

    it('should return error for unknown action', async () => {
      const result = await provider.executeAction(stubCreds, {
        resourceId: 'inc-123',
        action: 'unknown_action',
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain('Unknown action');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful GetCallerIdentity', async () => {
      mockSTSSend.mockResolvedValue({ Account: '123456789012' });

      const result = await provider.testConnection(stubCreds);
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockSTSSend.mockRejectedValue(new Error('AccessDenied'));

      const result = await provider.testConnection(stubCreds);
      expect(result).toBe(false);
    });
  });
});
