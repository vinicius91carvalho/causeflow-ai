import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CloudCredentials } from '../../../../src/shared/application/ports/cloud-provider.port.js';

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    aws: { region: 'sa-east-1' },
    cloudProvider: { ssmCommandTimeoutS: 5 },
    sts: { roleArn: 'arn:test', roleSessionPrefix: 'causeflow', defaultDuration: 900, maxDuration: 3600 },
  },
}));

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockECSSend = vi.fn();
vi.mock('@aws-sdk/client-ecs', () => ({
  ECSClient: vi.fn().mockImplementation(() => ({ send: mockECSSend })),
  UpdateServiceCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  DescribeServicesCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  DescribeTaskDefinitionCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  RegisterTaskDefinitionCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  ListTaskDefinitionsCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

const mockSSMSend = vi.fn();
vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn().mockImplementation(() => ({ send: mockSSMSend })),
  SendCommandCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  GetCommandInvocationCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

const { restartService, scaleService, rollbackService, runSSMCommand } = await import(
  '../../../../src/shared/infra/cloud/aws-action-executor.js'
);

describe('AWS Action Executor', () => {
  const creds: CloudCredentials = {
    provider: 'aws',
    credentials: { accessKeyId: 'AKID', secretAccessKey: 'SECRET', sessionToken: 'TOKEN' },
    region: 'sa-east-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('restartService', () => {
    it('should trigger force new deployment', async () => {
      mockECSSend.mockResolvedValue({});

      const result = await restartService(creds, { service: 'api-server', cluster: 'prod' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Force new deployment');
    });

    it('should fail when service param is missing', async () => {
      const result = await restartService(creds, {});
      expect(result.success).toBe(false);
      expect(result.output).toContain('Missing required param');
    });

    it('should use default cluster when not specified', async () => {
      mockECSSend.mockResolvedValue({});

      const result = await restartService(creds, { service: 'api-server' });
      expect(result.success).toBe(true);

      const call = mockECSSend.mock.calls[0]![0];
      expect(call.input.cluster).toBe('default');
    });
  });

  describe('scaleService', () => {
    it('should update desired count', async () => {
      mockECSSend.mockResolvedValue({});

      const result = await scaleService(creds, { service: 'api-server', cluster: 'prod', desiredCount: 5 });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Scaled');
    });

    it('should fail without required params', async () => {
      const result = await scaleService(creds, { service: 'api-server' });
      expect(result.success).toBe(false);
    });
  });

  describe('rollbackService', () => {
    it('should rollback to previous task definition', async () => {
      mockECSSend
        .mockResolvedValueOnce({
          services: [
            { taskDefinition: 'arn:aws:ecs:sa-east-1:123:task-definition/api:5' },
          ],
        })
        .mockResolvedValueOnce({
          taskDefinition: { family: 'api' },
        })
        .mockResolvedValueOnce({
          taskDefinitionArns: [
            'arn:aws:ecs:sa-east-1:123:task-definition/api:5',
            'arn:aws:ecs:sa-east-1:123:task-definition/api:4',
          ],
        })
        .mockResolvedValueOnce({});

      const result = await rollbackService(creds, { service: 'api-server', cluster: 'prod' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Rolled back');
      expect(result.output).toContain('api:4');
    });

    it('should fail when no previous revision exists', async () => {
      mockECSSend
        .mockResolvedValueOnce({
          services: [{ taskDefinition: 'arn:task:api:1' }],
        })
        .mockResolvedValueOnce({ taskDefinition: { family: 'api' } })
        .mockResolvedValueOnce({ taskDefinitionArns: ['arn:task:api:1'] });

      const result = await rollbackService(creds, { service: 'api-server' });
      expect(result.success).toBe(false);
      expect(result.output).toContain('No previous task definition');
    });
  });

  describe('runSSMCommand', () => {
    it('should send command and poll for success', async () => {
      mockSSMSend
        .mockResolvedValueOnce({ Command: { CommandId: 'cmd-123' } })
        .mockResolvedValueOnce({
          Status: 'Success',
          StandardOutputContent: 'command output',
        });

      const result = await runSSMCommand(creds, {
        instanceIds: ['i-123'],
        command: 'echo hello',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('command output');
    });

    it('should fail without required params', async () => {
      const result = await runSSMCommand(creds, { command: 'echo hello' });
      expect(result.success).toBe(false);
    });

    it('should handle failed command', async () => {
      mockSSMSend
        .mockResolvedValueOnce({ Command: { CommandId: 'cmd-123' } })
        .mockResolvedValueOnce({
          Status: 'Failed',
          StandardErrorContent: 'permission denied',
        });

      const result = await runSSMCommand(creds, {
        instanceIds: ['i-123'],
        command: 'rm -rf /',
      });

      expect(result.success).toBe(false);
      expect(result.output).toBe('permission denied');
    });
  });
});
